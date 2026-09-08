// Quote media uses the same private Drive root and folder ledger as orders, but
// keeps its own file ledger so quote references can never be confused with OPs.
var QUOTE_MEDIA_HEADERS_ = Object.freeze({
  Archivos_Cotizacion: ['Archivo_ID', 'Numero_Cotizacion', 'Item_ID', 'Foto_ID', 'Tipo', 'Nombre', 'Mime_Type', 'Bytes', 'Hash_SHA256', 'File_ID', 'Parent_ID', 'Estado', 'URL', 'Version', 'Creado_Por', 'Request_ID', 'Fecha_Registro', 'Plan_JSON']
});

function qmConfigured_() {
  return typeof mdConfigured_ === 'function' && mdConfigured_() && optionalProperty_('QUOTE_DOCUMENTS_SCHEMA_VERSION', '') === '1';
}
function qmSchema_() {
  if (!qmConfigured_()) throw appError_('QUOTE_DOCUMENT_SCHEMA_NOT_READY', 'Falta instalar el archivo documental de cotizaciones.', 503);
  mdSchema_();
  Object.keys(QUOTE_MEDIA_HEADERS_).forEach(function(name) { assertHeaders_(name, QUOTE_MEDIA_HEADERS_[name]); });
}
function qmPhotoManifest_(raw, field) {
  if (!Array.isArray(raw) || raw.length > ORDER_MEDIA_LIMITS_.perItem) quoteInputError_(field, 'Se admiten hasta seis referencias por mueble.');
  var ids = new Set();
  return raw.map(function(photo, index) {
    quoteObject_(photo, ['id', 'name', 'mime', 'size', 'sha256'], field);
    var id = quoteText_(photo.id, field + '.id', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) quoteInputError_(field, 'La identidad de la fotografía está repetida.');
    ids.add(id);
    var size = quoteInteger_(photo.size, field + '.size', 1);
    if (size > ORDER_MEDIA_LIMITS_.bytes) quoteInputError_(field, 'Una fotografía supera el tamaño admitido.');
    if (!/^[a-f0-9]{64}$/.test(photo.sha256 || '')) quoteInputError_(field, 'Falta la huella de la fotografía.');
    return { id: id, name: quoteText_(photo.name, field + '.name', 180, true),
      mime: quoteEnum_(photo.mime, ['image/jpeg', 'image/png', 'image/webp'], field + '.mime'), size: size, sha256: photo.sha256, position: index + 1 };
  });
}
function qmFolder_(folders, additions, ids, key, name, parent, reuseParent) {
  var found = mdUnique_(folders.concat(additions), 'Clave', key);
  if (found) {
    if (!found.File_ID || (!reuseParent && found.Parent_ID !== parent)) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'La carpeta reservada no coincide con su ubicación.', 409);
    return found.File_ID;
  }
  var id = ids.shift() || mdIds_(1)[0];
  additions.push({ Clave: key, File_ID: id, Nombre: mdFolderName_(name), Parent_ID: parent, Fecha_Registro: now_().toISOString() });
  return id;
}
function qmPlan_(draft, items, result, session, stamp) {
  qmSchema_();
  var rootId = requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID'), root = mdMeta_(rootId);
  if (root.trashed || root.mimeType !== 'application/vnd.google-apps.folder' || root.name !== '02_DOCUMENTOS_CLIENTES') throw appError_('DRIVE_ROOT_MISMATCH', 'La raíz documental no corresponde a Maderarte.', 503);
  var count = items.reduce(function(sum, item) { return sum + (item.photos || []).length; }, 0);
  var bytes = items.reduce(function(sum, item) { return sum + (item.photos || []).reduce(function(n, photo) { return n + photo.size; }, 0); }, 0);
  if (count > ORDER_MEDIA_LIMITS_.count || bytes > ORDER_MEDIA_LIMITS_.totalBytes) quoteInputError_('items.photos', 'Las referencias exceden el límite documental. No se descartó ninguna.');
  var ids = mdIds_(count + 10), folders = listRows_('Carpetas_Documentales'), additions = [], date = new Date(stamp);
  var year = Utilities.formatDate(date, MADERARTE_APP.TIMEZONE, 'yyyy');
  var month = Number(Utilities.formatDate(date, MADERARTE_APP.TIMEZONE, 'MM'));
  var months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var scope = mdScope_();
  var yearId = qmFolder_(folders, additions, ids, scope + ':Y:' + year, year, rootId, false);
  var monthId = qmFolder_(folders, additions, ids, scope + ':M:' + year + '-' + month, ('0' + month).slice(-2) + '_' + months[month - 1], yearId, false);
  var clientKey = scope + ':C:' + year + ':' + sha256_(draft.client.document).slice(0, 32);
  var clientId = qmFolder_(folders, additions, ids, clientKey, 'CC-' + draft.client.document + ' - ' + draft.client.name, monthId, true);
  var quotesId = qmFolder_(folders, additions, ids, clientKey + ':QUOTES', '00_COTIZACIONES', clientId, false);
  var quoteId = qmFolder_(folders, additions, ids, scope + ':QUOTE:' + result.number, result.number, quotesId, false);
  var pdfParent = qmFolder_(folders, additions, ids, scope + ':QUOTE:' + result.number + ':PDF', '01_COTIZACION', quoteId, false);
  var photoParent = qmFolder_(folders, additions, ids, scope + ':QUOTE:' + result.number + ':MEDIA', '02_REFERENCIAS', quoteId, false);
  var files = [];
  items.forEach(function(item) { (item.photos || []).forEach(function(photo) {
    var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[photo.mime];
    files.push({ Archivo_ID: item.id + '-F-' + photo.id, Numero_Cotizacion: result.number, Item_ID: item.id, Foto_ID: photo.id,
      Tipo: 'FOTO', Nombre: item.id + '-' + photo.position + '.' + ext, Mime_Type: photo.mime, Bytes: photo.size, Hash_SHA256: photo.sha256,
      File_ID: ids.shift() || mdIds_(1)[0], Parent_ID: photoParent, Estado: 'PENDIENTE', Version: 1, Creado_Por: session.profile.uid,
      Request_ID: result.requestId, Fecha_Registro: stamp, Plan_JSON: JSON.stringify({ originalName: photo.name, position: photo.position }) });
  }); });
  var publicData = { kind: 'quote', number: result.number, date: stamp, advisor: session.profile.name || '', branchCode: draft.branch,
    client: draft.client, notes: draft.notes, items: items, subtotal: draft.subtotal, discount: draft.discount, total: draft.total,
    folders: { month: monthId, client: clientId, quotes: quotesId, quote: quoteId }, issued: true };
  if (typeof osActive_ === 'function' && osActive_()) publicData.sandbox = OWNER_SANDBOX_CONTEXT_.id;
  files.push({ Archivo_ID: result.number + '-PDF-V1', Numero_Cotizacion: result.number, Tipo: 'COTIZACION', Nombre: result.number + '.pdf', Mime_Type: 'application/pdf',
    File_ID: ids.shift() || mdIds_(1)[0], Parent_ID: pdfParent, Estado: 'PENDIENTE', Version: 1, Creado_Por: session.profile.uid,
    Request_ID: result.requestId, Fecha_Registro: stamp, Plan_JSON: JSON.stringify(publicData) });
  if (files.some(function(file) { return String(file.Plan_JSON || '').length > 45000; })) quoteInputError_('items', 'El documento es demasiado extenso para conservar su versión íntegra.');
  var requests = [];
  if (additions.length) requests.push(orderAppendRequest_('Carpetas_Documentales', additions));
  requests.push(orderAppendRequest_('Archivos_Cotizacion', files));
  requests.push(orderAppendRequest_('Documentos', files.map(function(file) { return {
    ID_Documento: file.Archivo_ID, Tipo_Documento: file.Tipo, Numero_Relacionado: result.number, Cedula_NIT: draft.client.document,
    Nombre_Cliente: draft.client.name, Nombre_Archivo: file.Nombre, File_ID: file.File_ID, Mime_Type: file.Mime_Type, Version: 1,
    Activo: 'NO', Fecha_Registro: stamp, Operador: session.profile.uid, Request_ID: result.requestId
  }; })));
  var pdf = files[files.length - 1];
  requests.push(orderAppendRequest_('Versiones_Documentos', [{ Version_ID: pdf.Archivo_ID, Tipo_Documento: 'COTIZACION', Numero_Relacionado: result.number,
    Version: 1, Activo: 'NO', File_ID: pdf.File_ID, Nombre_Archivo: pdf.Nombre, Generado_Por: session.profile.uid, Request_ID: result.requestId }]));
  result.mediaWorkflow = 1;
  return requests;
}

function qmRows_(number) { return listRows_('Archivos_Cotizacion').filter(function(row) { return row.Numero_Cotizacion === number; }); }
function qmSlot_(number, id) {
  var slot = mdUnique_(qmRows_(number), 'Archivo_ID', id);
  if (!slot) throw appError_('MEDIA_NOT_FOUND', 'No existe esa referencia en la cotización.', 404);
  return slot;
}
function qmAccess_(number, context, write) {
  var session = validateSessionToken_(context.sessionToken, false);
  requirePermission_(session, 'cotizaciones.read');
  var row = mdUnique_(listRows_('Cotizaciones'), 'Numero_Cotizacion', number);
  if (!row) throw appError_('QUOTE_NOT_FOUND', 'No se encontró la cotización.', 404);
  var all = session.permissions.indexOf('*') !== -1, branches = session.profile && session.profile.branches || [];
  if (!all && branches.indexOf(row.Sede) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  if (write) {
    requirePermission_(session, 'cotizaciones.create');
    if (!all && row.Creado_Por !== session.profile.uid && session.permissions.indexOf('cotizaciones.update.all') === -1) throw appError_('QUOTE_DOCUMENT_FORBIDDEN', 'Solo el responsable o un administrador puede completar este documento.', 403);
    if (!(typeof osActive_ === 'function' && osActive_()) && (!MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', 'PREPARACION') !== 'OPERACION' || optionalProperty_('QUOTE_DOCUMENTS_ENABLED', 'NO') !== 'SI')) {
      throw appError_('DOCUMENT_WRITES_DISABLED', 'La finalización de cotizaciones todavía no está habilitada.', 403);
    }
    if (normalizeCode_(row.Estado) === 'ANULADA') throw appError_('DOCUMENT_REVISION_CHANGED', 'La cotización fue anulada; no se sobrescribirá su documento.', 409);
  }
  qmSchema_();
  return { row: row, session: session };
}
function qmLocked_(run) {
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('DOCUMENT_BUSY', 'Hay otra operación documental en curso. Consulta su resultado.', 503);
  try {
    if (typeof assertNoUnresolvedOrderFence_ === 'function') assertNoUnresolvedOrderFence_();
    assertNoUnresolvedQuoteFence_();
    return run();
  } finally { lock.releaseLock(); }
}
function qmVerifyMeta_(slot, meta) {
  var plan = slot.Tipo === 'COTIZACION' ? sha256_(slot.Plan_JSON) : slot.Hash_SHA256;
  mdVerifyMeta_(meta, slot.File_ID, slot.Nombre, slot.Mime_Type, slot.Parent_ID, plan);
}
function qmDownload_(slot) {
  var meta = mdMeta_(slot.File_ID); qmVerifyMeta_(slot, meta);
  var max = slot.Tipo === 'COTIZACION' ? ORDER_MEDIA_LIMITS_.pdfBytes : ORDER_MEDIA_LIMITS_.bytes;
  if (Number(meta.size) > max) throw appError_('MEDIA_INVALID', 'El archivo de Drive excede el límite.', 413);
  var bytes = mdDrive_('drive/v3/files/' + encodeURIComponent(slot.File_ID) + '?alt=media').getBlob().getBytes();
  if (bytes.length > max || !mdMagic_(bytes, slot.Mime_Type)) throw appError_('MEDIA_INVALID', 'El contenido de Drive no coincide con su tipo.', 409);
  if ((slot.Tipo !== 'COTIZACION' || slot.Estado === 'LISTO') && (bytes.length !== Number(slot.Bytes) || mdBytesHash_(bytes) !== slot.Hash_SHA256)) throw appError_('MEDIA_HASH_MISMATCH', 'El archivo cambió o quedó incompleto.', 409);
  return bytes;
}
function qmStore_(slot, bytes) {
  mdEnsureFolder_(slot.Parent_ID);
  try { return qmDownload_(slot); }
  catch (error) { if (error.appCode !== 'DRIVE_REQUEST_FAILED' || error.details && error.details.status !== 404) throw error; }
  var boundary = 'maddy_quote_' + Utilities.getUuid().replace(/-/g, '');
  var metadata = { id: slot.File_ID, name: slot.Nombre, parents: [slot.Parent_ID], mimeType: slot.Mime_Type,
    appProperties: { maddyScope: mdScope_(), maddyPlan: slot.Tipo === 'COTIZACION' ? sha256_(slot.Plan_JSON) : slot.Hash_SHA256 } };
  var start = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)
    + '\r\n--' + boundary + '\r\nContent-Type: ' + slot.Mime_Type + '\r\n\r\n';
  var body = Utilities.newBlob(start).getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  try { mdDrive_('upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: body }); }
  catch (error) { /* Exact-ID readback decides whether Google committed. */ }
  return qmDownload_(slot);
}
function qmReadyRequests_(slot, bytes) {
  var url = mdFileUrl_(slot.File_ID), doc = mdUnique_(listRows_('Documentos'), 'ID_Documento', slot.Archivo_ID);
  if (!doc) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'Falta el registro reservado del documento.', 409);
  return orderUpdateRequests_('Archivos_Cotizacion', slot._row, { Estado: 'LISTO', URL: url, Bytes: bytes.length, Hash_SHA256: mdBytesHash_(bytes) })
    .concat(orderUpdateRequests_('Documentos', doc._row, { URL: url, Hash_SHA256: mdBytesHash_(bytes), Activo: 'SI', Fecha_Emision: slot.Fecha_Registro }));
}
function qmPhotoStatus_(number, context) {
  qmAccess_(number, context, false);
  var files = qmRows_(number);
  return { number: number, complete: files.some(function(row) { return row.Tipo === 'COTIZACION' && row.Estado === 'LISTO'; }),
    files: files.map(function(row) { var plan = row.Tipo === 'FOTO' ? parseJson_(row.Plan_JSON, {}) : {};
      return { id: row.Archivo_ID, itemId: row.Item_ID || '', clientLineId: String(row.Item_ID || '').replace(number + '-I-', ''), photoId: row.Foto_ID || '',
        type: row.Tipo, name: plan.originalName || row.Nombre, position: plan.position || 0, mime: row.Mime_Type, size: Number(row.Bytes) || 0,
        sha256: row.Hash_SHA256 || '', ready: row.Estado === 'LISTO', url: row.Estado === 'LISTO' ? row.URL : '' };
    }) };
}
function qmUploadPhoto_(payload, context) {
  return qmLocked_(function() {
    qmAccess_(payload.number, context, true);
    var slot = qmSlot_(payload.number, payload.id);
    if (slot.Tipo !== 'FOTO') throw appError_('MEDIA_INVALID', 'Este espacio no corresponde a una fotografía.', 400);
    var bytes = mdDecode_(payload.base64, ORDER_MEDIA_LIMITS_.bytes);
    if (bytes.length !== Number(slot.Bytes) || mdBytesHash_(bytes) !== slot.Hash_SHA256 || !mdMagic_(bytes, slot.Mime_Type)) throw appError_('MEDIA_HASH_MISMATCH', 'La fotografía no coincide con la cotización emitida.', 409);
    var stored = qmStore_(slot, bytes); orderAtomicBatch_(qmReadyRequests_(slot, stored));
    return { number: payload.number, id: slot.Archivo_ID, ready: true };
  });
}
function qmReadPhoto_(payload, context) {
  qmAccess_(payload.number, context, false);
  var slot = qmSlot_(payload.number, payload.id);
  if (slot.Tipo !== 'FOTO' || slot.Estado !== 'LISTO') throw appError_('MEDIA_NOT_READY', 'La fotografía aún no está confirmada.', 409);
  return { id: slot.Archivo_ID, dataUrl: 'data:' + slot.Mime_Type + ';base64,' + Utilities.base64Encode(qmDownload_(slot)) };
}
function qmPreparePdf_(payload, context) {
  mdInternal_(context);
  return qmLocked_(function() {
    var access = qmAccess_(payload.number, context, true), files = qmRows_(payload.number), slot = mdUnique_(files, 'Tipo', 'COTIZACION');
    if (!slot) throw appError_('DOCUMENT_NOT_PLANNED', 'Esta cotización no tiene un plan documental reservado.', 409);
    if (slot.Estado === 'LISTO') { qmDownload_(slot); return { complete: true, number: payload.number, pdfUrl: slot.URL }; }
    var data = parseJson_(slot.Plan_JSON, null);
    if (!data || data.kind !== 'quote' || data.number !== payload.number || data.total !== Number(access.row.Total_Cotizado)) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'El documento no coincide con la cotización confirmada.', 409);
    mdEnsureFolder_(slot.Parent_ID);
    listRows_('Carpetas_Documentales').filter(function(row) { return row.Parent_ID === data.folders.quote; }).forEach(function(row) { mdEnsureFolder_(row.File_ID); });
    data.items = data.items.map(function(item) {
      return Object.assign({}, item, { photos: (item.photos || []).map(function(photo) {
        var file = mdUnique_(files, 'Archivo_ID', item.id + '-F-' + photo.id);
        if (!file || file.Estado !== 'LISTO') throw appError_('QUOTE_PHOTOS_PENDING', 'Faltan fotografías por confirmar; la cotización se conserva.', 409);
        return 'data:' + file.Mime_Type + ';base64,' + Utilities.base64Encode(qmDownload_(file));
      }) });
    });
    delete data.folders;
    return { complete: false, number: payload.number, id: slot.Archivo_ID, planHash: sha256_(slot.Plan_JSON), document: data };
  });
}
function qmConfirmPdf_(payload, context) {
  mdInternal_(context);
  return qmLocked_(function() {
    var access = qmAccess_(payload.number, context, true), slot = qmSlot_(payload.number, payload.id);
    if (slot.Tipo !== 'COTIZACION' || sha256_(slot.Plan_JSON) !== payload.planHash) throw appError_('DOCUMENT_REVISION_CHANGED', 'La versión documental no coincide.', 409);
    var bytes = mdDecode_(payload.base64, ORDER_MEDIA_LIMITS_.pdfBytes);
    if (!mdMagic_(bytes, 'application/pdf')) throw appError_('PDF_INVALID', 'El generador no entregó un PDF válido.', 502);
    var stored = qmStore_(slot, bytes), data = parseJson_(slot.Plan_JSON, null), requests = qmReadyRequests_(slot, stored);
    var client = mdUnique_(listRows_('Clientes'), 'Cedula_NIT', access.row.Cedula_NIT);
    var version = mdUnique_(listRows_('Versiones_Documentos'), 'Version_ID', slot.Archivo_ID);
    if (!client || !version) throw appError_('DOCUMENT_INTEGRITY_ERROR', 'Falta una referencia documental reservada.', 409);
    requests = requests.concat(orderUpdateRequests_('Cotizaciones', access.row._row, {
      URL_PDF_Cotizacion: mdFileUrl_(slot.File_ID), URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client), URL_Carpeta_Mes: mdFolderUrl_(data.folders.month),
      Actualizado_Por: access.session.profile.uid, Actualizado_En: now_().toISOString()
    }), orderUpdateRequests_('Clientes', client._row, { URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client) }),
    orderUpdateRequests_('Versiones_Documentos', version._row, { URL: mdFileUrl_(slot.File_ID), Hash_SHA256: mdBytesHash_(stored), Activo: 'SI', Fecha_Generacion: slot.Fecha_Registro }));
    orderAtomicBatch_(requests);
    return { complete: true, number: payload.number, pdfUrl: mdFileUrl_(slot.File_ID) };
  });
}
function qmReadPdf_(payload, context) {
  qmAccess_(payload.number, context, false);
  var slot = mdUnique_(qmRows_(payload.number), 'Tipo', 'COTIZACION');
  if (!slot || slot.Estado !== 'LISTO') throw appError_('PDF_PENDING', 'El PDF de la cotización todavía está pendiente.', 409);
  return { name: slot.Nombre, mime: 'application/pdf', base64: Utilities.base64Encode(qmDownload_(slot)) };
}

// Owner-run installation. Adds only the quote file ledger; existing commercial
// rows and the order document tables are never rewritten.
function prepararDocumentosCotizaciones() {
  if (MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', '') !== 'PREPARACION') throw appError_('SCHEMA_SETUP_NOT_ALLOWED', 'Prepara cotizaciones solo con la operación comercial deshabilitada.', 403);
  if (countRows_('Cotizaciones') !== 0) throw appError_('QUOTE_SCHEMA_HAS_DATA', 'La pestaña Cotizaciones ya contiene registros; revisa antes de preparar el archivo.', 409);
  mdSchema_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('QUOTE_SCHEMA_BUSY', 'Hay otra preparación en curso.', 503);
  try {
    var ss = getSpreadsheet_(), name = 'Archivos_Cotizacion', headers = QUOTE_MEDIA_HEADERS_[name], sheet = ss.getSheetByName(name), requests = [];
    if (sheet) {
      if (JSON.stringify(getHeaders_(sheet)) !== JSON.stringify(headers) || sheet.getLastRow() > 1) throw appError_('SHEET_SCHEMA_MISMATCH', 'El archivo de cotizaciones contiene datos o encabezados inesperados.', 409);
    } else {
      var id = 2110001030, used = ss.getSheets().map(function(tab) { return tab.getSheetId(); }); while (used.indexOf(id) !== -1) id++;
      requests.push({ addSheet: { properties: { sheetId: id, title: name, gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 20), frozenRowCount: 1 } } } });
      requests.push({ updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 }, rows: [{ values: headers.map(orderCell_) }], fields: 'userEnteredValue' } });
    }
    if (requests.length) orderAtomicBatch_(requests);
    getScriptProperties_().setProperty('QUOTE_DOCUMENTS_SCHEMA_VERSION', '1');
    qmSchema_();
    var result = { ok: true, quoteFileSheet: 'Archivos_Cotizacion', commercialWrites: false, quoteSave: 'NO', quoteDocuments: 'NO' };
    Logger.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}
function diagnosticarCotizacionesMaddy() {
  var result = { version: 'cotizaciones-1', commercialWrites: MADERARTE_APP.COMMERCIAL_WRITES, mode: getConfigValue_('MODO_OPERACION', ''),
    schema: qmConfigured_(), quoteSave: optionalProperty_('QUOTE_SAVE_ENABLED', 'NO'), quoteDocuments: optionalProperty_('QUOTE_DOCUMENTS_ENABLED', 'NO'),
    acceptance: optionalProperty_('QUOTE_DOCUMENTS_ACCEPTED', 'NO'), errors: [] };
  try { qmSchema_(); } catch (error) { result.errors.push({ component: 'Esquema cotizaciones', code: error.appCode || 'ERROR' }); }
  result.ok = result.schema && result.errors.length === 0; result.productionReady = false;
  Logger.log(JSON.stringify(result)); return result;
}
