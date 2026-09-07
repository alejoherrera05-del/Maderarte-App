// Document identities are committed WITH the order before any Drive file exists.
// All later writes address reserved IDs/rows: retries never append another sale.
var ORDER_MEDIA_HEADERS_ = Object.freeze({
  Carpetas_Documentales: ['Clave', 'File_ID', 'Nombre', 'Parent_ID', 'Fecha_Registro'],
  Archivos_Orden: ['Archivo_ID', 'Numero_OP', 'Item_ID', 'Foto_ID', 'Tipo', 'Nombre', 'Mime_Type', 'Bytes', 'Hash_SHA256', 'File_ID', 'Parent_ID', 'Estado', 'URL', 'Version', 'Creado_Por', 'Request_ID', 'Fecha_Registro', 'Plan_JSON']
});
var ORDER_MEDIA_LIMITS_ = Object.freeze({ perItem: 6, count: 24, bytes: 700000, totalBytes: 8000000, pdfBytes: 12000000 });

function mdConfigured_() { return optionalProperty_('ORDER_DOCUMENTS_SCHEMA_VERSION', '') === '1'; }
function mdSchema_() {
  if (!mdConfigured_()) throw appError_('DOCUMENT_SCHEMA_NOT_READY', 'Falta instalar el esquema documental.', 503);
  Object.keys(ORDER_MEDIA_HEADERS_).forEach(function(name) { assertHeaders_(name, ORDER_MEDIA_HEADERS_[name]); });
}
function mdUnique_(rows, key, value) {
  var found = rows.filter(function(row) { return String(row[key]) === String(value); });
  if (found.length > 1) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'Hay identidades documentales repetidas; requiere revisión.', 409);
  return found[0] || null;
}
function mdBytesHash_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
function mdPhotoManifest_(raw, field) {
  if (!Array.isArray(raw) || raw.length > ORDER_MEDIA_LIMITS_.perItem) orderInputError_(field, 'Se admiten hasta seis referencias por mueble.');
  var ids = new Set();
  return raw.map(function(photo, index) {
    orderObject_(photo, ['id', 'name', 'mime', 'size', 'sha256'], field);
    var id = orderText_(photo.id, field + '.id', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) orderInputError_(field, 'La identidad de la fotografía está repetida.');
    ids.add(id);
    var size = orderInteger_(photo.size, field + '.size', 1);
    if (size > ORDER_MEDIA_LIMITS_.bytes) orderInputError_(field, 'Una fotografía supera el tamaño admitido.');
    if (!/^[a-f0-9]{64}$/.test(photo.sha256 || '')) orderInputError_(field, 'Falta la huella de la fotografía.');
    return { id: id, name: orderText_(photo.name, field + '.name', 180, true), mime: orderEnum_(photo.mime, ['image/jpeg', 'image/png', 'image/webp'], field + '.mime'), size: size, sha256: photo.sha256, position: index + 1 };
  });
}
function mdDrive_(path, options) {
  var opts = Object.assign({ method: 'get', muteHttpExceptions: true }, options || {});
  opts.headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() });
  var response = UrlFetchApp.fetch('https://www.googleapis.com/' + path, opts);
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) throw appError_('DRIVE_REQUEST_FAILED', 'Drive no confirmó la operación. Reintenta el mismo archivo.', 503, { status: code });
  return response;
}
function mdMeta_(id) {
  return JSON.parse(mdDrive_('drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,mimeType,parents,size,trashed,appProperties').getContentText());
}
function mdIds_(count) {
  var ids = JSON.parse(mdDrive_('drive/v3/files/generateIds?space=drive&type=files&count=' + count).getContentText()).ids;
  if (!Array.isArray(ids) || ids.length !== count || new Set(ids).size !== count) throw appError_('DRIVE_IDS_UNCONFIRMED', 'No se pudieron reservar identidades para los documentos.', 503);
  return ids;
}
function mdScope_() { return sha256_(requiredProperty_('SPREADSHEET_ID')).slice(0, 32); }
function mdFolderName_(value) { return String(value).replace(/[\\/\u0000-\u001f]/g, '-').trim().slice(0, 170); }

function mdPlan_(draft, items, result, session, stamp) {
  mdSchema_();
  var rootId = requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID');
  var root = mdMeta_(rootId);
  if (root.trashed || root.mimeType !== 'application/vnd.google-apps.folder' || root.name !== '02_DOCUMENTOS_CLIENTES') throw appError_('DRIVE_ROOT_MISMATCH', 'La raíz documental no corresponde a Maderarte.', 503);
  var count = items.reduce(function(sum, item) { return sum + (item.photos || []).length; }, 0);
  var bytes = items.reduce(function(sum, item) { return sum + (item.photos || []).reduce(function(n, photo) { return n + photo.size; }, 0); }, 0);
  if (count > ORDER_MEDIA_LIMITS_.count || bytes > ORDER_MEDIA_LIMITS_.totalBytes) orderInputError_('items.photos', 'Las referencias exceden el límite documental. No se descartó ninguna.');
  var ids = mdIds_(count + 10); // year, month, client, quote folder, OP, four subfolders, PDF
  var folders = listRows_('Carpetas_Documentales');
  var additions = [];
  function folder(key, name, parent, reuseParent) {
    var found = mdUnique_(folders.concat(additions), 'Clave', key);
    if (found) {
      if (!found.File_ID || (!reuseParent && found.Parent_ID !== parent)) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'La carpeta reservada no coincide con su ubicación.', 409);
      return found.File_ID;
    }
    var id = ids.shift();
    if (!id) id = mdIds_(1)[0];
    additions.push({ Clave: key, File_ID: id, Nombre: mdFolderName_(name), Parent_ID: parent, Fecha_Registro: stamp });
    return id;
  }
  var date = new Date(stamp);
  var year = Utilities.formatDate(date, MADERARTE_APP.TIMEZONE, 'yyyy');
  var month = Number(Utilities.formatDate(date, MADERARTE_APP.TIMEZONE, 'MM'));
  var months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var scope = mdScope_();
  var yearId = folder(scope + ':Y:' + year, year, rootId);
  var monthId = folder(scope + ':M:' + year + '-' + month, ('0' + month).slice(-2) + '_' + months[month - 1], yearId);
  // Month belongs to the client's FIRST operation of this year, not every new OP.
  var clientKey = scope + ':C:' + year + ':' + sha256_(draft.client.document).slice(0, 32);
  var clientId = folder(clientKey, 'CC-' + draft.client.document + ' - ' + draft.client.name, monthId, true);
  folder(clientKey + ':QUOTES', '00_COTIZACIONES', clientId);
  var opId = folder(scope + ':OP:' + result.number, result.number, clientId);
  var pdfParent = folder(scope + ':OP:' + result.number + ':PDF', '01_ORDEN_DE_PEDIDO', opId);
  folder(scope + ':OP:' + result.number + ':PAY', '02_RECIBOS_Y_ABONOS', opId);
  folder(scope + ':OP:' + result.number + ':DELIVERY', '03_REMISIONES', opId);
  var photoParent = folder(scope + ':OP:' + result.number + ':MEDIA', '04_SOPORTES', opId);
  var files = [];
  items.forEach(function(item) { (item.photos || []).forEach(function(photo) {
    var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[photo.mime];
    files.push({ Archivo_ID: item.id + '-F-' + photo.id, Numero_OP: result.number, Item_ID: item.id, Foto_ID: photo.id,
      Tipo: 'FOTO', Nombre: item.id + '-' + photo.position + '.' + ext, Mime_Type: photo.mime, Bytes: photo.size, Hash_SHA256: photo.sha256,
      File_ID: ids.shift() || mdIds_(1)[0], Parent_ID: photoParent, Estado: 'PENDIENTE', Version: 1, Creado_Por: session.profile.uid,
      Request_ID: result.requestId, Fecha_Registro: stamp, Plan_JSON: JSON.stringify({ originalName: photo.name, position: photo.position }) });
  }); });
  var publicData = { number: result.number, date: stamp, advisor: session.profile.name || '', branchCode: draft.branch, client: draft.client,
    notes: draft.notes, items: items, subtotal: draft.subtotal, discount: draft.discount, total: draft.total,
    order: { paid: draft.paid, balance: draft.balance, payments: draft.payments.map(function(p) { return { method: p.method, amount: p.amount }; }) },
    folders: { client: clientId, order: opId }, issued: true };
  // items contain descriptions/photo manifests, never payment notes or raw bytes.
  files.push({ Archivo_ID: result.number + '-PDF-V1', Numero_OP: result.number, Tipo: 'OP', Nombre: result.number + '.pdf', Mime_Type: 'application/pdf',
    File_ID: ids.shift() || mdIds_(1)[0], Parent_ID: pdfParent, Estado: 'PENDIENTE', Version: 1, Creado_Por: session.profile.uid,
    Request_ID: result.requestId, Fecha_Registro: stamp, Plan_JSON: JSON.stringify(publicData) });
  if (files.some(function(file) { return String(file.Plan_JSON || '').length > 45000; })) orderInputError_('items', 'El documento es demasiado extenso para conservar su versión íntegra.');
  var requests = [];
  if (additions.length) requests.push(orderAppendRequest_('Carpetas_Documentales', additions));
  requests.push(orderAppendRequest_('Archivos_Orden', files));
  requests.push(orderAppendRequest_('Documentos', files.map(function(file) { return {
    ID_Documento: file.Archivo_ID, Tipo_Documento: file.Tipo, Numero_Relacionado: result.number, Cedula_NIT: draft.client.document,
    Nombre_Cliente: draft.client.name, Nombre_Archivo: file.Nombre, File_ID: file.File_ID, Mime_Type: file.Mime_Type, Version: 1,
    Activo: 'NO', Fecha_Registro: stamp, Operador: session.profile.uid, Request_ID: result.requestId
  }; })));
  var pdf = files[files.length - 1];
  requests.push(orderAppendRequest_('Versiones_Documentos', [{ Version_ID: pdf.Archivo_ID, Tipo_Documento: 'OP', Numero_Relacionado: result.number,
    Version: 1, Activo: 'NO', File_ID: pdf.File_ID, Nombre_Archivo: pdf.Nombre, Generado_Por: session.profile.uid, Request_ID: result.requestId }]));
  result.mediaWorkflow = 1;
  return requests;
}

function mdAccess_(number, context, write) {
  var session = validateSessionToken_(context.sessionToken, false);
  requirePermission_(session, 'ordenes.read');
  var row = mdUnique_(listRows_('Ordenes_Pedido'), 'Numero_OP', number);
  if (!row) throw appError_('ORDER_NOT_FOUND', 'No se encontró el pedido.', 404);
  var all = session.permissions.indexOf('*') !== -1;
  var branches = session.profile && session.profile.branches || [];
  if (!all && branches.indexOf(row.Sede) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  if (write) {
    requirePermission_(session, 'ordenes.create');
    if (!all && row.Creado_Por !== session.profile.uid && session.permissions.indexOf('ordenes.update.all') === -1) throw appError_('ORDER_DOCUMENT_FORBIDDEN', 'Solo el responsable o un administrador puede completar estos documentos.', 403);
    if (!MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', 'PREPARACION') !== 'OPERACION' || optionalProperty_('ORDER_DOCUMENTS_ENABLED', 'NO') !== 'SI') throw appError_('DOCUMENT_WRITES_DISABLED', 'La finalización documental todavía no está habilitada.', 403);
    if (row.Estado === 'ANULADA' || Number(row.Version) !== 1) throw appError_('DOCUMENT_REVISION_CHANGED', 'La orden cambió; requiere una nueva versión documental.', 409);
  }
  mdSchema_();
  return { row: row, session: session };
}
function mdLocked_(run) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('DOCUMENT_BUSY', 'Hay otra operación documental en curso. Consulta su resultado.', 503);
  try { assertNoUnresolvedOrderFence_(); return run(); } finally { lock.releaseLock(); }
}
function mdVerifyMeta_(meta, id, name, mime, parent, planHash) {
  if (meta.trashed || meta.id !== id || meta.name !== name || meta.mimeType !== mime || (meta.parents || []).indexOf(parent) === -1
    || (!meta.appProperties || meta.appProperties.maddyScope !== mdScope_())
    || planHash && (!meta.appProperties || meta.appProperties.maddyPlan !== planHash)) {
    throw appError_('DRIVE_IDENTITY_MISMATCH', 'Un archivo no coincide con su identidad reservada. No se sobrescribirá.', 409);
  }
}
function mdEnsureFolder_(id, visited) {
  var rootId = requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID');
  if (id === rootId) return;
  visited = visited || [];
  if (visited.indexOf(id) !== -1 || visited.length > 8) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'La estructura de carpetas requiere revisión.', 409);
  var row = mdUnique_(listRows_('Carpetas_Documentales'), 'File_ID', id);
  if (!row) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'La carpeta no tiene reserva.', 409);
  mdEnsureFolder_(row.Parent_ID, visited.concat([id]));
  try { mdVerifyMeta_(mdMeta_(id), id, row.Nombre, 'application/vnd.google-apps.folder', row.Parent_ID); return; }
  catch (error) { if (error.appCode !== 'DRIVE_REQUEST_FAILED' || error.details && error.details.status !== 404) throw error; }
  try { mdDrive_('drive/v3/files?fields=id', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ id: id, name: row.Nombre,
    mimeType: 'application/vnd.google-apps.folder', parents: [row.Parent_ID], appProperties: { maddyScope: mdScope_() } }) }); }
  catch (error) { /* A lost response or 409 is resolved only by exact-ID readback. */ }
  mdVerifyMeta_(mdMeta_(id), id, row.Nombre, 'application/vnd.google-apps.folder', row.Parent_ID);
}
function mdDecode_(base64, maximum) {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(maximum / 3) * 4 || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw appError_('MEDIA_INVALID', 'El archivo no contiene datos válidos.', 400);
  var bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > maximum) throw appError_('MEDIA_INVALID', 'El archivo excede el límite admitido.', 400);
  return bytes;
}
function mdMagic_(bytes, mime) {
  var b = bytes.map(function(v) { return (v + 256) % 256; });
  var ascii = function(start, text) { return text.split('').every(function(c, i) { return b[start + i] === c.charCodeAt(0); }); };
  return mime === 'image/jpeg' ? b[0] === 255 && b[1] === 216 && b[2] === 255
    : mime === 'image/png' ? [137,80,78,71,13,10,26,10].every(function(v,i) { return b[i] === v; })
    : mime === 'image/webp' ? ascii(0,'RIFF') && ascii(8,'WEBP')
    : mime === 'application/pdf' ? ascii(0,'%PDF-') : false;
}
function mdDownload_(slot) {
  var meta = mdMeta_(slot.File_ID);
  mdVerifyMeta_(meta, slot.File_ID, slot.Nombre, slot.Mime_Type, slot.Parent_ID, slot.Tipo === 'OP' ? sha256_(slot.Plan_JSON) : slot.Hash_SHA256);
  var max = slot.Tipo === 'OP' ? ORDER_MEDIA_LIMITS_.pdfBytes : ORDER_MEDIA_LIMITS_.bytes;
  if (Number(meta.size) > max) throw appError_('MEDIA_INVALID', 'El archivo de Drive excede el límite.', 413);
  var bytes = mdDrive_('drive/v3/files/' + encodeURIComponent(slot.File_ID) + '?alt=media').getBlob().getBytes();
  if (bytes.length > max || !mdMagic_(bytes, slot.Mime_Type)) throw appError_('MEDIA_INVALID', 'El contenido de Drive no coincide con su tipo.', 409);
  if ((slot.Tipo !== 'OP' || slot.Estado === 'LISTO') && (bytes.length !== Number(slot.Bytes) || mdBytesHash_(bytes) !== slot.Hash_SHA256)) throw appError_('MEDIA_HASH_MISMATCH', 'La fotografía cambió o quedó incompleta.', 409);
  return bytes;
}
function mdStore_(slot, bytes) {
  mdEnsureFolder_(slot.Parent_ID);
  try { return mdDownload_(slot); }
  catch (error) { if (error.appCode !== 'DRIVE_REQUEST_FAILED' || error.details && error.details.status !== 404) throw error; }
  var boundary = 'maddy_' + Utilities.getUuid().replace(/-/g, '');
  var metadata = { id: slot.File_ID, name: slot.Nombre, parents: [slot.Parent_ID], mimeType: slot.Mime_Type,
    appProperties: { maddyScope: mdScope_(), maddyPlan: slot.Tipo === 'OP' ? sha256_(slot.Plan_JSON) : slot.Hash_SHA256 } };
  var start = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)
    + '\r\n--' + boundary + '\r\nContent-Type: ' + slot.Mime_Type + '\r\n\r\n';
  var body = Utilities.newBlob(start).getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  try { mdDrive_('upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: body }); }
  catch (error) { /* Exact-ID readback decides whether Google committed. Never allocate another ID. */ }
  return mdDownload_(slot);
}
function mdRows_(number) { return listRows_('Archivos_Orden').filter(function(row) { return row.Numero_OP === number; }); }
function mdSlot_(number, id) {
  var slot = mdUnique_(mdRows_(number), 'Archivo_ID', id);
  if (!slot) throw appError_('MEDIA_NOT_FOUND', 'No existe esa referencia en el pedido.', 404);
  return slot;
}
function mdFileUrl_(id) { return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'; }
function mdFolderUrl_(id) { return 'https://drive.google.com/drive/folders/' + encodeURIComponent(id); }
function mdPhotoStatus_(number, context) {
  mdAccess_(number, context, false);
  var files = mdRows_(number);
  return { number: number, complete: files.some(function(row) { return row.Tipo === 'OP' && row.Estado === 'LISTO'; }),
    files: files.map(function(row) { var plan = row.Tipo === 'FOTO' ? parseJson_(row.Plan_JSON, {}) : {};
      return { id: row.Archivo_ID, itemId: row.Item_ID || '', photoId: row.Foto_ID || '', type: row.Tipo, name: plan.originalName || row.Nombre,
        position: plan.position || 0, mime: row.Mime_Type, size: Number(row.Bytes) || 0, sha256: row.Hash_SHA256 || '', ready: row.Estado === 'LISTO', url: row.Estado === 'LISTO' ? row.URL : '' };
    }) };
}
function mdReadyRequests_(slot, bytes) {
  var url = mdFileUrl_(slot.File_ID);
  var documentRow = mdUnique_(listRows_('Documentos'), 'ID_Documento', slot.Archivo_ID);
  if (!documentRow) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'Falta el registro reservado del documento.', 409);
  return orderUpdateRequests_('Archivos_Orden', slot._row, { Estado: 'LISTO', URL: url, Bytes: bytes.length, Hash_SHA256: mdBytesHash_(bytes) })
    .concat(orderUpdateRequests_('Documentos', documentRow._row, { URL: url, Hash_SHA256: mdBytesHash_(bytes), Activo: 'SI', Fecha_Emision: slot.Fecha_Registro }));
}
function mdUploadPhoto_(payload, context) {
  return mdLocked_(function() {
    mdAccess_(payload.number, context, true);
    var slot = mdSlot_(payload.number, payload.id);
    if (slot.Tipo !== 'FOTO') throw appError_('MEDIA_INVALID', 'Este espacio no corresponde a una fotografía.', 400);
    var bytes = mdDecode_(payload.base64, ORDER_MEDIA_LIMITS_.bytes);
    if (bytes.length !== Number(slot.Bytes) || mdBytesHash_(bytes) !== slot.Hash_SHA256 || !mdMagic_(bytes, slot.Mime_Type)) throw appError_('MEDIA_HASH_MISMATCH', 'La fotografía no coincide con el pedido confirmado.', 409);
    var stored = mdStore_(slot, bytes);
    var requests = mdReadyRequests_(slot, stored);
    var item = mdUnique_(listRows_('Orden_Items'), 'Item_ID', slot.Item_ID);
    if (!item) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'No existe el mueble de la fotografía.', 409);
    if (parseJson_(slot.Plan_JSON, {}).position === 1) requests = requests.concat(orderUpdateRequests_('Orden_Items', item._row, { URL_Foto: mdFileUrl_(slot.File_ID) }));
    orderAtomicBatch_(requests);
    return { number: payload.number, id: slot.Archivo_ID, ready: true };
  });
}
function mdReadPhoto_(payload, context) {
  mdAccess_(payload.number, context, false);
  var slot = mdSlot_(payload.number, payload.id);
  if (slot.Tipo !== 'FOTO' || slot.Estado !== 'LISTO') throw appError_('MEDIA_NOT_READY', 'La fotografía aún no está confirmada.', 409);
  return { id: slot.Archivo_ID, dataUrl: 'data:' + slot.Mime_Type + ';base64,' + Utilities.base64Encode(mdDownload_(slot)) };
}
function mdInternal_(context) {
  if (!context.proxyMeta || context.proxyMeta.documentPipeline !== true) throw appError_('DOCUMENT_PIPELINE_ONLY', 'Esta operación pertenece al generador documental.', 403);
}
function mdPreparePdf_(payload, context) {
  mdInternal_(context);
  return mdLocked_(function() {
    var access = mdAccess_(payload.number, context, true);
    var files = mdRows_(payload.number);
    var slot = mdUnique_(files, 'Tipo', 'OP');
    if (!slot) throw appError_('DOCUMENT_NOT_PLANNED', 'Esta orden no tiene un plan documental reservado.', 409);
    if (slot.Estado === 'LISTO') {
      mdDownload_(slot);
      return { complete: true, number: payload.number, pdfUrl: slot.URL };
    }
    var data = parseJson_(slot.Plan_JSON, null);
    if (!data || data.number !== payload.number || data.total !== Number(access.row.Valor_Total)) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'El documento no coincide con la orden confirmada.', 409);
    mdEnsureFolder_(slot.Parent_ID);
    // Create ALL reserved OP subfolders, including receipts/remissions, even when empty.
    listRows_('Carpetas_Documentales').filter(function(row) { return row.Parent_ID === data.folders.order; }).forEach(function(row) { mdEnsureFolder_(row.File_ID); });
    data.items = data.items.map(function(item) {
      return Object.assign({}, item, { photos: (item.photos || []).map(function(photo) {
        var file = mdUnique_(files, 'Archivo_ID', item.id + '-F-' + photo.id);
        if (!file || file.Estado !== 'LISTO') throw appError_('ORDER_PHOTOS_PENDING', 'Faltan fotografías por confirmar; se conserva la orden.', 409);
        return 'data:' + file.Mime_Type + ';base64,' + Utilities.base64Encode(mdDownload_(file));
      }) });
    });
    delete data.folders;
    return { complete: false, number: payload.number, id: slot.Archivo_ID, planHash: sha256_(slot.Plan_JSON), document: data };
  });
}
function mdConfirmPdf_(payload, context) {
  mdInternal_(context);
  return mdLocked_(function() {
    var access = mdAccess_(payload.number, context, true);
    var slot = mdSlot_(payload.number, payload.id);
    if (slot.Tipo !== 'OP' || sha256_(slot.Plan_JSON) !== payload.planHash) throw appError_('DOCUMENT_REVISION_CHANGED', 'La versión documental no coincide.', 409);
    var bytes = mdDecode_(payload.base64, ORDER_MEDIA_LIMITS_.pdfBytes);
    if (!mdMagic_(bytes, 'application/pdf')) throw appError_('PDF_INVALID', 'El generador no entregó un PDF válido.', 502);
    var stored = mdStore_(slot, bytes);
    var data = parseJson_(slot.Plan_JSON, null);
    var requests = mdReadyRequests_(slot, stored);
    var client = mdUnique_(listRows_('Clientes'), 'Cedula_NIT', access.row.Cedula_NIT);
    var version = mdUnique_(listRows_('Versiones_Documentos'), 'Version_ID', slot.Archivo_ID);
    if (!client || !version) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'Falta una referencia documental reservada.', 409);
    requests = requests.concat(orderUpdateRequests_('Ordenes_Pedido', access.row._row, {
      URL_PDF_OP: mdFileUrl_(slot.File_ID), URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client), URL_Carpeta_OP: mdFolderUrl_(data.folders.order), Estado_Documentos: 'COMPLETO'
    }), orderUpdateRequests_('Clientes', client._row, { URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client) }),
    orderUpdateRequests_('Versiones_Documentos', version._row, { URL: mdFileUrl_(slot.File_ID), Hash_SHA256: mdBytesHash_(stored), Activo: 'SI', Fecha_Generacion: slot.Fecha_Registro }));
    listRows_('Abonos').filter(function(row) { return row.Numero_OP === payload.number; }).forEach(function(row) {
      requests = requests.concat(orderUpdateRequests_('Abonos', row._row, { URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client) }));
    });
    // Fixed reserved rows, not append: safe after an ambiguous Sheets response.
    orderAtomicBatch_(requests);
    return { complete: true, number: payload.number, pdfUrl: mdFileUrl_(slot.File_ID) };
  });
}

// Editor-only installer. Never routed through doPost. Safe with an empty base.
function prepararDocumentosOrdenes() {
  prepararEsquemaGuardadoOrdenes();
  return mdLocked_(function() {
    if (MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', '') !== 'PREPARACION') throw appError_('SCHEMA_SETUP_NOT_ALLOWED', 'La preparación exige operación comercial deshabilitada.', 403);
    verifyCommercialBaseZero_();
    var ss = getSpreadsheet_();
    var requests = [];
    var used = ss.getSheets().map(function(sheet) { return sheet.getSheetId(); });
    Object.keys(ORDER_MEDIA_HEADERS_).forEach(function(name, index) {
      var sheet = ss.getSheetByName(name);
      var headers = ORDER_MEDIA_HEADERS_[name];
      if (sheet) {
        var actual = getHeaders_(sheet);
        if (JSON.stringify(actual) !== JSON.stringify(headers) || sheet.getLastRow() > 1) throw appError_('SHEET_SCHEMA_MISMATCH', 'La preparación documental encontró datos o encabezados inesperados.', 409, { sheet: name });
        return;
      }
      var id = 2110001020 + index;
      while (used.indexOf(id) !== -1) id++;
      used.push(id);
      requests.push({ addSheet: { properties: { sheetId: id, title: name, gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 20), frozenRowCount: 1 } } } });
      requests.push({ updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 }, rows: [{ values: headers.map(orderCell_) }], fields: 'userEnteredValue' } });
    });
    if (requests.length) orderAtomicBatch_(requests);
    getScriptProperties_().setProperty('ORDER_DOCUMENTS_SCHEMA_VERSION', '1');
    mdSchema_();
    return { ok: true, coreSheets: 23, documentSheets: 2, commercialWrites: false, enabled: false };
  });
}
function diagnosticarDocumentosMaddy() {
  var result = { version: 'documentos-1', commercialWrites: MADERARTE_APP.COMMERCIAL_WRITES, mode: getConfigValue_('MODO_OPERACION', ''),
    schema: mdConfigured_(), drive: false, documentWrites: optionalProperty_('ORDER_DOCUMENTS_ENABLED', 'NO'), acceptance: optionalProperty_('ORDER_DOCUMENTS_ACCEPTED', 'NO'), errors: [] };
  try { var root = mdMeta_(requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID')); result.drive = root.mimeType === 'application/vnd.google-apps.folder' && root.name === '02_DOCUMENTOS_CLIENTES' && !root.trashed; }
  catch (error) { result.errors.push({ component: 'Drive API', code: error.appCode || 'ERROR' }); }
  try { mdSchema_(); } catch (error) { result.errors.push({ component: 'Esquema documental', code: error.appCode }); }
  result.ok = result.drive && result.schema && result.errors.length === 0;
  result.productionReady = false; // This diagnostic is not an end-to-end acceptance.
  Logger.log(JSON.stringify(result));
  return result;
}
