import { photoReference } from './order-media.js?v=progress-1';

export async function prepareQuoteMedia(payload, photos, onProgress = () => {}) {
  const result = structuredClone(payload);
  const media = [];
  for (const item of result.items) {
    const references = photos.get(Number(item.clientLineId)) || photos.get(item.clientLineId) || [];
    if (references.length > 6) throw new Error('Cada mueble admite hasta seis referencias. El borrador conserva todas las imágenes.');
    item.photos = [];
    for (const [index, photo] of references.entries()) {
      onProgress({ step: 'prepare', status: 'running', message: `Preparando referencia ${index + 1} del mueble ${item.clientLineId}…` });
      const normalized = await photoReference(photo, index);
      item.photos.push(normalized.manifest);
      media.push({ clientLineId: String(item.clientLineId), photoId: normalized.manifest.id, sha256: normalized.manifest.sha256, base64: normalized.base64 });
    }
  }
  const bytes = result.items.reduce((sum, item) => sum + item.photos.reduce((total, photo) => total + photo.size, 0), 0);
  if (media.length > 24 || bytes > 8_000_000) throw new Error('La cotización admite hasta 24 fotos y 8 MB preparados. No se ha enviado ni descartado ninguna referencia.');
  return { ...result, _media: media };
}

export async function finishQuoteDocuments(number, media, request, progress = () => {}, onProgress = () => {}) {
  const emit = event => { try { onProgress(event); } catch {} };
  const readStatus = async () => {
    const response = await request('COTIZACION_DOCUMENTOS_ESTADO', { number });
    const state = response?.data;
    if (state?.number !== number || !Array.isArray(state.files)) throw new Error('No se pudo consultar la documentación de esta cotización.');
    return state;
  };
  const allReady = state => state.complete === true && state.files.length > 0
    && state.files.some(file => file.type === 'COTIZACION' && file.ready === true && file.url)
    && state.files.every(file => file.ready === true && file.url);

  emit({ step: 'photos', status: 'running' });
  const state = await readStatus();
  const photos = state.files.filter(file => file.type === 'FOTO');
  let ready = photos.filter(file => file.ready === true).length;
  const photoEvent = () => emit({
    step: 'photos',
    status: !photos.length ? 'skipped' : ready === photos.length ? 'complete' : 'running',
    detail: photos.length ? `${ready} de ${photos.length} referencias confirmadas` : 'Esta cotización no tiene fotografías'
  });
  photoEvent();
  if (state.complete === true) {
    if (!allReady(state)) throw new Error('La documentación todavía no está completa. Consulta la misma cotización.');
    emit({ step: 'document', status: 'complete' });
    emit({ step: 'verify', status: 'complete' });
    return state;
  }
  for (const file of photos.filter(file => !file.ready)) {
    const source = media.find(photo => String(photo.clientLineId) === String(file.itemId) && photo.photoId === file.photoId && photo.sha256 === file.sha256);
    if (!source) throw new Error('La cotización ya existe, pero falta una referencia en esta pestaña. Reabre la misma cotización para recuperarla; no emitas otra.');
    progress(`Guardando fotografía ${ready + 1} de ${photos.length}…`);
    const uploaded = await request('COTIZACION_FOTO_GUARDAR', { number, id: file.id, base64: source.base64 }, { timeoutMs: 90_000 });
    if (uploaded?.data?.ready !== true || uploaded.data.number !== number || uploaded.data.id !== file.id) throw new Error('Falta confirmar esta fotografía. Consulta la documentación de la misma cotización.');
    ready += 1;
    photoEvent();
  }
  progress('Generando el PDF y completando el archivo de la cotización…');
  emit({ step: 'document', status: 'running' });
  const completed = await request('COTIZACION_DOCUMENTOS_FINALIZAR', { number }, { timeoutMs: 150_000 });
  if (completed?.data?.complete !== true || completed.data.number !== number) throw new Error('Falta confirmar el PDF. Reintenta la documentación de la misma cotización.');
  emit({ step: 'document', status: 'complete' });
  emit({ step: 'verify', status: 'running' });
  const verified = await readStatus();
  if (!allReady(verified)) throw new Error('El PDF respondió, pero faltan enlaces por confirmar. Consulta la misma cotización.');
  emit({ step: 'verify', status: 'complete' });
  return verified;
}
