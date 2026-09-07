const fail = message => Object.assign(new Error(message), { code: 'ORDER_MEDIA_REQUIRED' });
const pattern = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
export async function photoReference(photo, index) {
  const match = pattern.exec(photo?.dataUrl || '');
  if (!match) throw fail('Usa fotografías JPG, PNG o WEBP. La referencia original se conserva en el borrador.');
  let mime = match[1], encoded = match[2];
  if (encoded.length > 28000000) throw fail('Una referencia es demasiado grande. Usa una fotografía de menos de 20 MB.');
  let bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  // Preserve already suitable bytes. Larger originals are normalized BEFORE the
  // immutable command is created; every retry uses these exact normalized bytes.
  if (bytes.length > 700000) {
    const image = new Image();
    image.src = photo.dataUrl;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000) throw fail('La imagen supera 40 megapíxeles. Reduce su resolución antes de guardar.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl;
    for (const quality of [0.86, 0.74, 0.62, 0.48]) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      if ((dataUrl.length - 23) * 0.75 <= 700000) break;
    }
    mime = 'image/jpeg'; encoded = dataUrl.split(',')[1];
    bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    canvas.width = canvas.height = 1;
  }
  if (!bytes.length || bytes.length > 700000) throw fail('La referencia no pudo prepararse sin exceder el límite. Reduce la imagen; no se ha enviado el pedido.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  return { manifest: { id: `p${index + 1}-${sha256.slice(0, 20)}`, name: String(photo.name || `Referencia ${index + 1}`).slice(0, 180), mime, size: bytes.length, sha256 }, base64: encoded };
}
export async function prepareOrderMedia(payload, photos, onProgress = () => {}) {
  const result = structuredClone(payload), media = [];
  for (const item of result.items) {
    const references = photos.get(Number(item.clientLineId)) || photos.get(item.clientLineId) || [];
    if (references.length > 6) throw fail('Cada mueble admite hasta seis referencias. El borrador conserva todas las imágenes.');
    item.photos = [];
    for (const [index, photo] of references.entries()) {
      onProgress({ step: 'prepare', status: 'running', message: `Preparando referencia ${index + 1} del mueble ${item.clientLineId}…` });
      const normalized = await photoReference(photo, index);
      item.photos.push(normalized.manifest);
      media.push({ clientLineId: item.clientLineId, photoId: normalized.manifest.id, sha256: normalized.manifest.sha256, base64: normalized.base64 });
    }
  }
  if (media.length > 24 || result.items.reduce((sum, item) => sum + item.photos.reduce((n, photo) => n + photo.size, 0), 0) > 8000000) throw fail('El pedido admite hasta 24 fotos y 8 MB preparados. No se ha enviado ni descartado ninguna referencia.');
  return { ...result, _media: media };
}
export async function finishOrderDocuments(number, media, request, progress = () => {}, onProgress = () => {}) {
  // UI events mirror actual confirmations. Folder creation and PDF generation
  // share one server request, so they are intentionally one visible stage.
  const emit = event => { try { onProgress(event); } catch { /* UI never changes persistence. */ } };
  const readStatus = async () => {
    const response = await request('ORDEN_DOCUMENTOS_ESTADO', { number });
    const state = response?.data;
    if (state?.number !== number || !Array.isArray(state.files)) throw fail('No se pudo consultar la documentación de esta orden.');
    return state;
  };
  const allReady = state => state.complete === true && state.files.length > 0
    && state.files.some(file => file.type === 'OP' && file.ready === true && file.url)
    && state.files.every(file => file.ready === true && file.url);
  emit({ step: 'photos', status: 'running', message: 'Consultando las referencias de la orden registrada…' });
  const state = await readStatus();
  const photos = state.files.filter(file => file.type === 'FOTO');
  let ready = photos.filter(file => file.ready === true).length;
  const photoEvent = () => emit({ step: 'photos', status: !photos.length ? 'skipped' : ready === photos.length ? 'complete' : 'running',
    detail: photos.length ? `${ready} de ${photos.length} referencias confirmadas` : 'Este pedido no tiene fotografías',
    message: photos.length ? `Fotografías: ${ready} de ${photos.length} confirmadas.` : 'Este pedido no requiere anexo fotográfico.' });
  photoEvent();
  if (state.complete === true) {
    if (!allReady(state)) throw fail('La documentación aún no está completa. No se confirmó el archivo de la orden.');
    emit({ step: 'document', status: 'complete', message: 'PDF ya archivado; se recuperó el mismo documento.' });
    emit({ step: 'verify', status: 'complete', message: 'Referencias y enlaces confirmados.' });
    return state;
  }
  for (const file of photos.filter(file => !file.ready)) {
    const source = media.find(photo => photo.clientLineId === file.clientLineId && photo.photoId === file.photoId && photo.sha256 === file.sha256);
    if (!source) throw fail('El pedido ya existe, pero falta una referencia en esta pestaña. Abre el pedido para recuperar la foto; no registres otra venta.');
    const message = `Guardando fotografía ${ready + 1} de ${photos.length}…`;
    progress(message); emit({ step: 'photos', status: 'running', message, detail: `${ready} de ${photos.length} referencias confirmadas` });
    const uploaded = await request('ORDEN_FOTO_GUARDAR', { number, id: file.id, base64: source.base64 }, { timeoutMs: 90000 });
    if (uploaded?.data?.ready !== true || uploaded.data.number !== number || uploaded.data.id !== file.id) throw fail('Falta confirmar esta fotografía. Consulta los documentos de la misma orden.');
    ready++; photoEvent();
  }
  const message = 'Generando el PDF y completando su archivo en Drive…';
  progress(message); emit({ step: 'document', status: 'running', message });
  const completed = await request('ORDEN_DOCUMENTOS_FINALIZAR', { number }, { timeoutMs: 150000 });
  if (completed?.data?.complete !== true || completed.data.number !== number) throw fail('Falta confirmar el PDF. Reintenta la documentación de la misma orden.');
  emit({ step: 'document', status: 'complete', message: 'El servidor confirmó el PDF archivado.' });
  emit({ step: 'verify', status: 'running', message: 'Comprobando los enlaces y las referencias guardadas…' });
  const verified = await readStatus();
  if (!allReady(verified)) throw fail('El PDF respondió, pero falta confirmar todos los enlaces. Consulta la misma orden.');
  emit({ step: 'verify', status: 'complete', message: 'Pedido y documentos confirmados.' });
  return verified;
}
