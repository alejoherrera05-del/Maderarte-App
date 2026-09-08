import { photoReference } from './order-media.js?v=progress-1';

export async function prepareQuoteMedia(payload, photos, onProgress = () => {}) {
  const result = structuredClone(payload), media = [];
  for (const item of result.items) {
    const references = photos.get(Number(item.clientLineId)) || photos.get(item.clientLineId) || [];
    if (references.length > 6) throw Object.assign(new Error('Cada mueble admite hasta seis referencias. El borrador conserva todas las imágenes.'), { code: 'QUOTE_MEDIA_REQUIRED' });
    item.photos = [];
    for (const [index, photo] of references.entries()) {
      onProgress({ step: 'prepare', status: 'running', message: `Preparando referencia ${index + 1} del mueble ${item.clientLineId}…` });
      const normalized = await photoReference(photo, index);
      item.photos.push(normalized.manifest);
      media.push({ clientLineId: item.clientLineId, photoId: normalized.manifest.id, sha256: normalized.manifest.sha256, base64: normalized.base64 });
    }
  }
  if (media.length > 24 || result.items.reduce((sum, item) => sum + item.photos.reduce((n, photo) => n + photo.size, 0), 0) > 8_000_000) {
    throw Object.assign(new Error('La cotización admite hasta 24 fotos y 8 MB preparados. No se ha enviado ni descartado ninguna referencia.'), { code: 'QUOTE_MEDIA_REQUIRED' });
  }
  return { ...result, _media: media };
}

export async function finishQuoteDocuments(number, media, request, status = () => {}, onProgress = () => {}) {
  const emit = event => { try { onProgress(event); } catch { /* UI cannot change persistence */ } };
  const readState = async () => {
    const response = await request('COTIZACION_DOCUMENTOS_ESTADO', { number });
    const state = response?.data;
    if (state?.number !== number || !Array.isArray(state.files)) throw new Error('No se pudo consultar el expediente de esta cotización.');
    return state;
  };
  const allReady = state => state.complete === true && state.files.length > 0
    && state.files.some(file => file.type === 'COTIZACION' && file.ready === true && file.url)
    && state.files.every(file => file.ready === true && file.url);
  emit({ step: 'photos', status: 'running', message: 'Comprobando las referencias asociadas a la propuesta.' });
  const initial = await readState();
  const photos = initial.files.filter(file => file.type === 'FOTO');
  let ready = photos.filter(file => file.ready === true).length;
  const photoEvent = () => emit({ step: 'photos', status: !photos.length ? 'skipped' : ready === photos.length ? 'complete' : 'running',
    detail: photos.length ? `${ready} de ${photos.length} referencias confirmadas` : 'Esta cotización no lleva fotografías',
    message: photos.length ? `Estoy archivando ${ready} de ${photos.length} referencias en el mueble correcto.` : 'Esta propuesta no lleva referencias fotográficas; continúo directamente con el documento.' });
  photoEvent();
  if (initial.complete === true) {
    if (!allReady(initial)) throw new Error('La documentación todavía no está completa. No se confirmó el PDF de la cotización.');
    emit({ step: 'document', status: 'complete', message: 'El PDF ya estaba archivado; recuperé el mismo documento.' });
    emit({ step: 'verify', status: 'complete', message: 'Cotización, referencias y enlaces confirmados.' });
    return initial;
  }
  for (const file of photos.filter(file => !file.ready)) {
    const source = media.find(photo => String(photo.clientLineId) === String(file.clientLineId) && photo.photoId === file.photoId && photo.sha256 === file.sha256);
    if (!source) throw Object.assign(new Error('La cotización ya existe, pero falta una referencia en esta pestaña. Reabre la cotización para recuperar el mismo archivo; no emitas otra.'), { code: 'QUOTE_MEDIA_REQUIRED' });
    const message = `Guardando fotografía ${ready + 1} de ${photos.length}…`;
    status(message); emit({ step: 'photos', status: 'running', message, detail: `${ready} de ${photos.length} referencias confirmadas` });
    const uploaded = await request('COTIZACION_FOTO_GUARDAR', { number, id: file.id, base64: source.base64 }, { timeoutMs: 90_000 });
    if (uploaded?.data?.ready !== true || uploaded.data.number !== number || uploaded.data.id !== file.id) throw new Error('Falta confirmar esta fotografía. Consulta la misma cotización.');
    ready++; photoEvent();
  }
  const message = 'Estoy generando el PDF aprobado y archivándolo en el expediente del cliente.';
  status(message); emit({ step: 'document', status: 'running', message });
  const completed = await request('COTIZACION_DOCUMENTOS_FINALIZAR', { number }, { timeoutMs: 150_000 });
  if (completed?.data?.complete !== true || completed.data.number !== number) throw new Error('Falta confirmar el PDF. Retoma la documentación de la misma cotización.');
  emit({ step: 'document', status: 'complete', message: 'Google confirmó el PDF dentro del expediente del cliente.' });
  emit({ step: 'verify', status: 'running', message: 'Estoy comprobando número, PDF, referencias y enlaces antes de terminar.' });
  const verified = await readState();
  if (!allReady(verified)) throw new Error('El PDF respondió, pero todavía falta confirmar algún enlace. Consulta la misma cotización.');
  emit({ step: 'verify', status: 'complete', message: 'Cotización emitida. Número, PDF, referencias y enlaces quedaron confirmados.' });
  return verified;
}
