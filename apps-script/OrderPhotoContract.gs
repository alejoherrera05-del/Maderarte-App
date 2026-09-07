function normalizeOrderPhotoRefs_(raw, path) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 10) orderInputError_(path, 'Usa como máximo diez referencias por mueble.');
  var ids = new Set();
  return raw.map(function(photo, index) {
    orderObject_(photo, ['id', 'name', 'mime', 'bytes', 'sha256'], path + '.' + index);
    var id = orderText_(photo.id, path + '.id', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) orderInputError_(path, 'Una referencia está repetida.');
    ids.add(id);
    var mime = orderEnum_(photo.mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], path + '.mime');
    var bytes = orderInteger_(photo.bytes, path + '.bytes', 1);
    if (bytes > ORDER_MAX_IMAGE_ || typeof photo.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(photo.sha256)) orderInputError_(path, 'Revisa la imagen: máximo 8 MB y huella válida.');
    return { id: id, name: orderText_(photo.name, path + '.name', 160, true), mime: mime, bytes: bytes, sha256: photo.sha256 };
  });
}
