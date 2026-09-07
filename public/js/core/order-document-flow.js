import { fileHash, encodeBytes } from './order-media.js';
export const DOCUMENT_TEMPLATE = 'maddy-documentos-1';
const CHUNK = 262144;
const TRANSIENT = ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE', 'DRIVE_RETRY', 'DOCUMENT_BUSY'];
const pause = () => new Promise(resolve => setTimeout(resolve, 350));
// Only documents of already-confirmed orders. Never creates orders/payments.
export function createDocumentFlow({ number, request, vault, renderPdf, progress = () => {}, active = () => true }) {
  async function call(action, payload = {}) {
    for (let attempt = 0; ; attempt++) {
      if (!active()) throw new Error('La sesión cambió. Entra con la cuenta que inició este pedido.');
      try { const value = await request(action, { number, ...payload }); if (!active()) throw new Error('La sesión cambió.'); return value.data; }
      catch (error) { if (attempt >= 1 || !TRANSIENT.includes(error.code)) throw error; await pause(); }
    }
  }
  async function readFile(file) {
    const bytes = new Uint8Array(file.bytes); let offset = 0;
    while (offset < bytes.length) {
      const part = await call('ORDEN_ARCHIVO_LEER', { key: file.key, offset });
      const data = Uint8Array.from(atob(part.data), x => x.charCodeAt(0));
      if (part.offset !== offset || part.nextOffset !== offset + data.length || part.nextOffset > bytes.length || !data.length || part.sha256 !== file.sha256) throw new Error('La lectura del archivo no coincide con su registro.');
      bytes.set(data, offset); offset = part.nextOffset;
    }
    if (await fileHash(bytes) !== file.sha256) throw new Error('La huella del archivo descargado no coincide.');
    return { bytes, mime: file.mime };
  }
  async function upload(spec, binary) {
    let state = await call('ORDEN_ARCHIVO_INICIAR', spec);
    if (state.done) return state.file;
    if (state.file.sha256 !== await fileHash(binary) || state.file.bytes !== binary.length) throw new Error('No se sustituirá una carga con contenido diferente.');
    let stalls = 0;
    while (!state.done) {
      const offset = state.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= binary.length) throw new Error('Drive indicó una posición de carga inválida.');
      const next = await call('ORDEN_ARCHIVO_PARTE', { key: state.file.key, sha256: state.file.sha256, offset, data: encodeBytes(binary.subarray(offset, offset + CHUNK)) });
      if (next.offset === offset) { if (++stalls > 2) throw new Error('La carga no avanzó. Conserva la orden y vuelve a completar sus archivos.'); } else stalls = 0;
      state = { ...state, ...next };
    }
    return state.file;
  }
  async function complete({ regeneratePendingPdf = false } = {}) {
    let state = await call('ORDEN_DOCUMENTOS_ESTADO');
    if (state.complete) return state;
    progress('Preparando carpetas del cliente y del pedido…');
    for (let round = 0; round < 12; round++) { state = await call('ORDEN_DOCUMENTOS_PREPARAR'); if (state.ready) break; }
    if (!state.ready || state.snapshot?.template !== DOCUMENT_TEMPLATE) throw new Error('No se completó la preparación documental. La orden se conserva.');
    const photos = state.snapshot.items.flatMap(item => item.photos), photoData = {};
    for (const [index, photo] of photos.entries()) {
      progress(`Conservando fotografía ${index + 1} de ${photos.length}…`);
      const record = state.files.find(file => file.key === photo.key);
      let source = await vault.get(photo.sha256);
      if (!source && record?.ready) source = await readFile(record);
      if (!source || await fileHash(source.bytes) !== photo.sha256) {
        const error = new Error(`Falta el original de «${photo.name}». Vuelve a adjuntar esa misma fotografía; el pedido no se repetirá.`);
        error.code = 'PHOTO_ORIGINAL_REQUIRED'; error.photo = photo; throw error;
      }
      if (!record?.ready) await upload({ photoKey: photo.key }, source.bytes);
      photoData[photo.key] = { name: photo.name, dataUrl: 'data:' + source.mime + ';base64,' + encodeBytes(source.bytes), type: source.mime };
    }
    state = await call('ORDEN_DOCUMENTOS_ESTADO');
    const receipts = ['', ...state.snapshot.payments.map(payment => payment.number)], cacheKeys = [];
    for (const receipt of receipts) {
      const existing = state.files.find(file => receipt ? file.type === 'RECIBO' && file.itemId === receipt : file.type === 'OP');
      const cacheKey = `pdf:${state.snapshotHash}:${receipt || 'OP'}`; cacheKeys.push(cacheKey);
      if (existing?.ready) continue;
      progress(receipt ? `Generando recibo ${receipt}…` : 'Generando la orden y su anexo fotográfico…');
      let pdf = await vault.get(cacheKey);
      if (!pdf) { const generated = await renderPdf(state.snapshot, photoData, receipt); pdf = { bytes: generated.bytes, mime: 'application/pdf' }; await vault.put(cacheKey, pdf); }
      const sha256 = await fileHash(pdf.bytes);
      if (existing && existing.sha256 !== sha256 && !regeneratePendingPdf) {
        const error = new Error('La copia local del PDF pendiente cambió o ya no está. Regenera solo el documento pendiente; no el pedido.'); error.code = 'PDF_REGENERATION_REQUIRED'; throw error;
      }
      await upload({ snapshotHash: state.snapshotHash, template: DOCUMENT_TEMPLATE, receipt, sha256, bytes: pdf.bytes.length, restart: Boolean(existing && existing.sha256 !== sha256 && regeneratePendingPdf) }, pdf.bytes);
    }
    progress('Verificando archivos y enlazándolos con la orden…');
    const result = await call('ORDEN_DOCUMENTOS_FINALIZAR', { snapshotHash: state.snapshotHash });
    if (!result.complete) throw new Error('La verificación no confirma todos los archivos. No se marcará completo.');
    for (const key of [...photos.map(photo => photo.sha256), ...cacheKeys]) { try { await vault.remove(key); } catch { /* Completed dossier remains confirmed. */ } }
    progress('Orden, fotografías y recibos archivados.'); return result;
  }
  return { complete, state: () => call('ORDEN_DOCUMENTOS_ESTADO'), readFile };
}
export async function renderOrderPdf(snapshot, photos, receipt) {
  const frame = document.createElement('iframe');
  frame.className = 'maddy-document-frame'; frame.title = 'Preparación del documento'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  let timer;
  const loaded = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('La plantilla no respondió. La orden se conserva.')), 15000); frame.onload = resolve; frame.onerror = () => reject(new Error('No se pudo abrir la plantilla documental.')); });
  frame.src = '/documento.html?v=docs-1'; document.body.append(frame);
  try {
    await loaded;
    for (let i = 0; i < 100 && !frame.contentWindow.maddyRenderDocument; i++) await new Promise(resolve => setTimeout(resolve, 50));
    if (!frame.contentWindow.maddyRenderDocument) throw new Error('La plantilla documental no se cargó. La orden se conserva.');
    const result = await frame.contentWindow.maddyRenderDocument(snapshot, photos, receipt);
    return { ...result, bytes: new Uint8Array(result.bytes) };
  } finally { clearTimeout(timer); frame.remove(); }
}
