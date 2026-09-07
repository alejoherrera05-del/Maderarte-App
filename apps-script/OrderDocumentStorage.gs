// Files and folders use IDs reserved BEFORE Drive writes. An uncertain response
// can be retried against the same ID; it must never allocate a replacement.
var ORDER_DOCUMENT_REVISION_ = 'maddy-documentos-1';
var ORDER_ARCHIVE_SHEET_ = 'Archivos_Orden';
var ORDER_ARCHIVE_HEADERS_ = ['Clave', 'Numero_OP', 'Item_ID', 'Tipo', 'File_ID', 'Parent_ID', 'Nombre', 'Mime', 'SHA256', 'Bytes', 'Estado', 'Snapshot_SHA256', 'Version', 'Usuario', 'Creado_En'];
var ORDER_UPLOAD_CHUNK_ = 262144;
var ORDER_MAX_IMAGE_ = 8388608;
var ORDER_MAX_PDF_ = 16777216;

function orderDocumentError_(code, message) { throw appError_(code, message, 409); }
function orderArchiveRows_() { return listRows_(ORDER_ARCHIVE_SHEET_); }
function orderArchiveRow_(key) {
  var rows = orderArchiveRows_().filter(function(row) { return row.Clave === key; });
  if (rows.length > 1) orderDocumentError_('DOCUMENT_INTEGRITY', 'El registro documental requiere revisión.');
  return rows[0] || null;
}
function orderDocumentFenceCheck_() {
  assertNoUnresolvedOrderFence_();
  var props = getScriptProperties_();
  var raw = props.getProperty('ORDER_DOCUMENT_PENDING');
  if (!raw) return;
  var fence = parseJson_(raw, null);
  var found = fence && listRows_('Idempotencia').filter(function(row) { return row.Request_ID === fence.id && row.Tipo_Operacion === 'ARCHIVO_ORDEN' && row.Resultado_JSON === fence.hash && row.Estado === 'CONFIRMADA'; });
  if (!found || found.length !== 1) orderDocumentError_('DOCUMENT_RESULT_PENDING', 'Hay una actualización documental sin confirmar. Consulta su estado antes de continuar.');
  props.deleteProperty('ORDER_DOCUMENT_PENDING');
}
function orderDocumentBatch_(requests, user, entity) {
  if (!requests.length) return;
  orderDocumentFenceCheck_();
  var id = 'DOC-' + Utilities.getUuid();
  var hash = sha256_(JSON.stringify(requests));
  var fence = JSON.stringify({ id: id, hash: hash });
  getScriptProperties_().setProperty('ORDER_DOCUMENT_PENDING', fence);
  if (getScriptProperties_().getProperty('ORDER_DOCUMENT_PENDING') !== fence) orderDocumentError_('DOCUMENT_RESULT_PENDING', 'No se pudo asegurar la recuperación documental.');
  requests.push(orderAppendRequest_('Idempotencia', [{ Request_ID: id, Fecha: now_().toISOString(), Tipo_Operacion: 'ARCHIVO_ORDEN', Entidad: 'DOCUMENTO', Entidad_ID: entity || '', Estado: 'CONFIRMADA', Resultado_JSON: hash, Usuario: user || '' }]));
  SpreadsheetApp.flush();
  try { orderAtomicBatch_(requests); }
  catch (error) { orderDocumentError_('DOCUMENT_RESULT_PENDING', 'Falta confirmar el registro documental. No se repetirá la venta.'); }
  orderDocumentFenceCheck_();
}
function orderDriveResponse_(path, options) {
  options = options || {};
  options.headers = Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() });
  options.muteHttpExceptions = true;
  options.followRedirects = false;
  try { return UrlFetchApp.fetch('https://www.googleapis.com/' + path, options); }
  catch (error) { orderDocumentError_('DRIVE_RETRY', 'No se confirmó la respuesta de Drive. Puedes continuar el mismo archivo.'); }
}
function orderDriveJson_(path, method, body) {
  var response = orderDriveResponse_(path, { method: method || 'get', contentType: 'application/json', ...(body === undefined ? {} : { payload: JSON.stringify(body) }) });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) orderDocumentError_('DRIVE_RETRY', 'Drive no confirmó la operación. No se crearán archivos sustitutos.');
  return parseJson_(response.getContentText(), {});
}
function orderDriveMeta_(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) orderDocumentError_('DOCUMENT_INTEGRITY', 'Referencia documental inválida.');
  var response = orderDriveResponse_('drive/v3/files/' + id + '?fields=id,name,mimeType,parents,trashed,size,sha256Checksum,appProperties,webViewLink');
  if (response.getResponseCode() === 404) return null;
  if (response.getResponseCode() !== 200) orderDocumentError_('DRIVE_RETRY', 'No se pudo consultar el archivo de Drive.');
  return parseJson_(response.getContentText(), {});
}
function orderDriveNewIds_(count) {
  var value = orderDriveJson_('drive/v3/files/generateIds?count=' + count + '&space=drive');
  if (!Array.isArray(value.ids) || value.ids.length !== count) orderDocumentError_('DRIVE_RETRY', 'Drive no asignó las identidades documentales.');
  return value.ids;
}
function orderFileMatches_(meta, row) {
  return Boolean(meta && !meta.trashed && meta.id === row.File_ID && meta.mimeType === row.Mime && meta.parents && meta.parents.indexOf(row.Parent_ID) >= 0 && meta.appProperties && meta.appProperties.maddyKey === row.Clave);
}
function orderFileComplete_(meta, row) {
  return orderFileMatches_(meta, row) && Number(meta.size) === Number(row.Bytes) && meta.sha256Checksum === row.SHA256;
}
function orderEnsureDriveFile_(row) {
  var meta = orderDriveMeta_(row.File_ID);
  if (!meta) {
    var body = { id: row.File_ID, name: row.Nombre, mimeType: row.Mime, parents: [row.Parent_ID], appProperties: { maddyKey: row.Clave } };
    var response = orderDriveResponse_('drive/v3/files?fields=id', { method: 'post', contentType: 'application/json', payload: JSON.stringify(body) });
    if ([200, 201, 409].indexOf(response.getResponseCode()) < 0) orderDocumentError_('DRIVE_RETRY', 'Drive no confirmó la creación. Se conserva la misma identidad para el reintento.');
    meta = orderDriveMeta_(row.File_ID);
  }
  if (!orderFileMatches_(meta, row)) orderDocumentError_('DRIVE_FILE_CHANGED', 'El archivo fue movido, eliminado o modificado fuera del flujo. Requiere revisión.');
  return meta;
}
function orderArchiveReserve_(value) {
  var existing = orderArchiveRow_(value.Clave);
  if (existing) {
    ['Numero_OP', 'Item_ID', 'Tipo', 'Mime', 'SHA256', 'Bytes', 'Snapshot_SHA256', 'Version'].forEach(function(key) {
      if (String(existing[key] || '') !== String(value[key] || '')) orderDocumentError_('DOCUMENT_CONTENT_CONFLICT', 'Ya existe una preparación de este archivo con contenido distinto. No se sobrescribirá.');
    });
    return existing;
  }
  value.File_ID = orderDriveNewIds_(1)[0];
  value.Estado = 'RESERVADO';
  value.Creado_En = now_().toISOString();
  orderDocumentBatch_([orderAppendRequest_(ORDER_ARCHIVE_SHEET_, [value])], value.Usuario, value.Numero_OP);
  return orderArchiveRow_(value.Clave);
}
function orderArchiveReady_(row) {
  if (row.Estado !== 'LISTO') orderDocumentBatch_(orderUpdateRequests_(ORDER_ARCHIVE_SHEET_, row._row, { Estado: 'LISTO' }), row.Usuario, row.Numero_OP);
  return Object.assign({}, row, { Estado: 'LISTO' });
}
function orderFolder_(key, parent, name, number, user, budget) {
  var row = orderArchiveRow_(key);
  if (row && row.Estado === 'LISTO') return row;
  if (budget.remaining <= 0) return null;
  budget.remaining--;
  if (!row) row = orderArchiveReserve_({ Clave: key, Numero_OP: number || '', Item_ID: '', Tipo: 'CARPETA', Parent_ID: parent, Nombre: sanitizeFolderName_(name), Mime: 'application/vnd.google-apps.folder', SHA256: '', Bytes: 0, Snapshot_SHA256: '', Version: 1, Usuario: user });
  orderEnsureDriveFile_(row);
  return orderArchiveReady_(row);
}
function orderDocumentFolders_(order, user, budget) {
  var rootId = requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID');
  var root = orderDriveMeta_(rootId);
  if (!root || root.trashed || root.mimeType !== 'application/vnd.google-apps.folder' || root.name !== '02_DOCUMENTOS_CLIENTES') orderDocumentError_('DRIVE_ROOT_MISMATCH', 'La raíz documental no corresponde al sistema.');
  var date = new Date(order.Fecha);
  if (isNaN(date.getTime())) orderDocumentError_('DOCUMENT_INTEGRITY', 'La fecha del pedido requiere revisión.');
  var year = Utilities.formatDate(date, MADERARTE_APP.TIMEZONE, 'yyyy');
  var month = Number(Utilities.formatDate(date, MADERARTE_APP.TIMEZONE, 'MM'));
  var clientKey = 'FC-' + sha256_(rootId + ':' + year + ':' + order.Cedula_NIT);
  var client = orderArchiveRow_(clientKey);
  if (!client || client.Estado !== 'LISTO') {
    var yf = orderFolder_('FY-' + sha256_(rootId + year), rootId, year, '', user, budget); if (!yf) return null;
    var mf = orderFolder_('FM-' + sha256_(yf.File_ID + month), yf.File_ID, MONTH_NAMES_[month - 1], '', user, budget); if (!mf) return null;
    client = orderFolder_(clientKey, mf.File_ID, order.Cedula_NIT + ' - ' + String(order.Nombre_Cliente).toUpperCase(), '', user, budget); if (!client) return null;
  }
  var quotes = orderFolder_('FQ-' + client.File_ID, client.File_ID, '00_COTIZACIONES', '', user, budget); if (!quotes) return null;
  var op = orderFolder_('FO-' + order.Numero_OP, client.File_ID, order.Numero_OP, order.Numero_OP, user, budget); if (!op) return null;
  var result = { client: client.File_ID, order: op.File_ID };
  var paths = [['pdf', '01_ORDEN_DE_PEDIDO'], ['receipts', '02_RECIBOS_Y_ABONOS'], ['remissions', '03_REMISIONES'], ['photos', '04_SOPORTES']];
  for (var i = 0; i < paths.length; i++) {
    var folder = orderFolder_('FS-' + order.Numero_OP + '-' + paths[i][0], op.File_ID, paths[i][1], order.Numero_OP, user, budget);
    if (!folder) return null;
    result[paths[i][0]] = folder.File_ID;
  }
  return result;
}
function orderUploadSessionKey_(row) { return 'ORDER_UPLOAD_' + sha256_(row.File_ID); }
function orderHeader_(response, name) {
  var headers = response.getAllHeaders();
  var key = Object.keys(headers).filter(function(key) { return key.toLowerCase() === name.toLowerCase(); })[0];
  return key ? String(headers[key]) : '';
}
function orderUploadStatus_(row, sessionUri) {
  var response = orderDriveResponse_(sessionUri.replace('https://www.googleapis.com/', ''), { method: 'put', headers: { 'Content-Range': 'bytes */' + row.Bytes }, payload: '' });
  var code = response.getResponseCode();
  if (code === 200 || code === 201) return { done: true, offset: Number(row.Bytes) };
  if (code === 404 || code === 410) return { expired: true, offset: 0 };
  if (code !== 308) orderDocumentError_('DRIVE_RETRY', 'No se pudo confirmar la parte recibida del archivo.');
  var range = orderHeader_(response, 'Range');
  var match = /^bytes=0-(\d+)$/.exec(range);
  return { done: false, offset: match ? Number(match[1]) + 1 : 0 };
}
function orderUploadOpen_(row) {
  var meta = orderEnsureDriveFile_(row);
  if (orderFileComplete_(meta, row)) { orderArchiveReady_(row); return { done: true, offset: Number(row.Bytes), fileId: row.File_ID }; }
  if (Number(meta.size || 0) !== 0 && meta.sha256Checksum !== row.SHA256) orderDocumentError_('DOCUMENT_HASH_MISMATCH', 'El contenido de Drive no coincide con la referencia. No se sobrescribirá.');
  var key = orderUploadSessionKey_(row);
  var uri = getScriptProperties_().getProperty(key);
  if (uri) {
    if (!uri.startsWith('https://www.googleapis.com/upload/drive/v3/files/' + row.File_ID + '?')) orderDocumentError_('DOCUMENT_INTEGRITY', 'La carga requiere revisión.');
    var status = orderUploadStatus_(row, uri);
    if (!status.expired) return Object.assign(status, { uri: uri, fileId: row.File_ID });
    getScriptProperties_().deleteProperty(key);
  }
  var response = orderDriveResponse_('upload/drive/v3/files/' + row.File_ID + '?uploadType=resumable', { method: 'patch', contentType: 'application/json', payload: '{}', headers: { 'X-Upload-Content-Type': row.Mime, 'X-Upload-Content-Length': String(row.Bytes) } });
  uri = orderHeader_(response, 'Location');
  if (response.getResponseCode() !== 200 || !uri.startsWith('https://www.googleapis.com/upload/drive/v3/files/' + row.File_ID + '?')) orderDocumentError_('DRIVE_RETRY', 'No se pudo iniciar la carga recuperable del archivo.');
  getScriptProperties_().setProperty(key, uri);
  if (getScriptProperties_().getProperty(key) !== uri) orderDocumentError_('DRIVE_RETRY', 'No se pudo conservar la carga recuperable.');
  return { done: false, offset: 0, uri: uri, fileId: row.File_ID };
}
function orderUploadBytes_(row, offset, base64) {
  if (!Number.isSafeInteger(offset) || offset < 0 || typeof base64 !== 'string' || base64.length > 350000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) orderDocumentError_('DOCUMENT_INPUT_INVALID', 'Parte de archivo inválida.');
  var bytes; try { bytes = Utilities.base64Decode(base64); } catch (e) { orderDocumentError_('DOCUMENT_INPUT_INVALID', 'No se pudo leer el archivo.'); }
  if (!bytes.length || bytes.length > ORDER_UPLOAD_CHUNK_ || offset + bytes.length > Number(row.Bytes) || (offset + bytes.length < Number(row.Bytes) && bytes.length !== ORDER_UPLOAD_CHUNK_)) orderDocumentError_('DOCUMENT_INPUT_INVALID', 'El tamaño de la parte no corresponde al archivo.');
  if (offset === 0 && !orderMediaSignature_(row.Mime, bytes)) orderDocumentError_('DOCUMENT_INPUT_INVALID', 'El formato real del archivo no corresponde a su extensión.');
  var status = orderUploadOpen_(row);
  if (status.done || status.offset !== offset) return { done: status.done, offset: status.offset };
  var response = orderDriveResponse_(status.uri.replace('https://www.googleapis.com/', ''), { method: 'put', contentType: row.Mime, payload: bytes, headers: { 'Content-Range': 'bytes ' + offset + '-' + (offset + bytes.length - 1) + '/' + row.Bytes } });
  if ([200, 201, 308].indexOf(response.getResponseCode()) < 0) orderDocumentError_('DRIVE_RETRY', 'No se confirmó esta parte. Se consultará Drive antes de reenviarla.');
  if (response.getResponseCode() === 308) {
    var next = /^bytes=0-(\d+)$/.exec(orderHeader_(response, 'Range'));
    return { done: false, offset: next ? Number(next[1]) + 1 : 0 };
  }
  var meta = orderDriveMeta_(row.File_ID);
  if (!orderFileComplete_(meta, row)) orderDocumentError_('DOCUMENT_HASH_MISMATCH', 'El archivo recibido no coincide con su huella. No se marcará completo.');
  orderArchiveReady_(row);
  getScriptProperties_().deleteProperty(orderUploadSessionKey_(row));
  return { done: true, offset: Number(row.Bytes) };
}
function orderMediaSignature_(mime, bytes) {
  var a = bytes.slice(0, 16).map(function(b) { return (b + 256) % 256; });
  var text = a.map(function(b) { return String.fromCharCode(b); }).join('');
  if (mime === 'application/pdf') return text.indexOf('%PDF-1.') === 0;
  if (mime === 'image/jpeg') return a[0] === 255 && a[1] === 216 && a[2] === 255;
  if (mime === 'image/png') return a.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (mime === 'image/webp') return text.slice(0, 4) === 'RIFF' && text.slice(8, 12) === 'WEBP';
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].indexOf(text.slice(0, 6)) >= 0;
  return false;
}
