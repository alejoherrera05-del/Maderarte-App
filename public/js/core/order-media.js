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
export async function prepareOrderMedia(payload, photos) {
  const result = structuredClone(payload), media = [];
  for (const item of result.items) {
    const references = photos.get(Number(item.clientLineId)) || photos.get(item.clientLineId) || [];
    if (references.length > 6) throw fail('Cada mueble admite hasta seis referencias. El borrador conserva todas las imágenes.');
    item.photos = [];
    for (const [index, photo] of references.entries()) {
      const normalized = await photoReference(photo, index);
      item.photos.push(normalized.manifest);
      media.push({ clientLineId: item.clientLineId, photoId: normalized.manifest.id, sha256: normalized.manifest.sha256, base64: normalized.base64 });
    }
  }
  if (media.length > 24 || result.items.reduce((sum, item) => sum + item.photos.reduce((n, photo) => n + photo.size, 0), 0) > 8000000) throw fail('El pedido admite hasta 24 fotos y 8 MB preparados. No se ha enviado ni descartado ninguna referencia.');
  return { ...result, _media: media };
}
export async function finishOrderDocuments(number, media, request, progress = () => {}) {
  const response = await request('ORDEN_DOCUMENTOS_ESTADO', { number });
  const state = response?.data;
  if (state?.number !== number || !Array.isArray(state.files)) throw fail('No se pudo consultar la documentación de esta orden.');
  if (state.complete === true) return state;
  for (const file of state.files.filter(file => file.type === 'FOTO' && !file.ready)) {
    const source = media.find(photo => photo.clientLineId === file.clientLineId && photo.photoId === file.photoId && photo.sha256 === file.sha256);
    if (!source) throw fail('El pedido ya existe, pero falta una referencia en esta pestaña. Abre el pedido para recuperar la foto; no registres otra venta.');
    progress(`Guardando referencia ${file.position} de su mueble…`);
    await request('ORDEN_FOTO_GUARDAR', { number, id: file.id, base64: source.base64 }, { timeoutMs: 90000 });
  }
  progress('Generando y archivando el PDF del pedido…');
  const completed = await request('ORDEN_DOCUMENTOS_FINALIZAR', { number }, { timeoutMs: 150000 });
  if (completed?.data?.complete !== true || completed.data.number !== number) throw fail('Falta confirmar el PDF. Reintenta la documentación de la misma orden.');
  return completed.data;
}
