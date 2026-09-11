var QUOTE_MEDIA_HEADERS_ = Object.freeze({
  Archivos_Cotizacion: ['Archivo_ID', 'Numero_Cotizacion', 'Item_ID', 'Foto_ID', 'Tipo', 'Nombre', 'Mime_Type', 'Bytes', 'Hash_SHA256', 'File_ID', 'Parent_ID', 'Estado', 'URL', 'Version', 'Creado_Por', 'Request_ID', 'Fecha_Registro', 'Plan_JSON']
});

function qmdConfigured_() {
  if (typeof osActive_ === 'function' && osActive_()) return OWNER_SANDBOX_CONTEXT_.quoteSchemaVersion === 1;
  return optionalProperty_('QUOTE_DOCUMENTS_SCHEMA_VERSION', '') === '1';
}
function qmdSchema_() {
  if (!qmdConfigured_()) throw appError_('QUOTE_DOCUMENT_SCHEMA_NOT_READY', 'Falta preparar el esquema documental de cotizaciones.', 503);
  mdSchema_();
  assertHeaders_('Archivos_Cotizacion', QUOTE_MEDIA_HEADERS_.Archivos_Cotizacion);
}
function qmdRows_(number) { return listRows_('Archivos_Cotizacion').filter(function(row) { return String(row.Numero_Cotizacion || '') === number; }); }
function qmdSlot_(number, id) {
  var slot = mdUnique_(qmdRows_(number), 'Archivo_ID', id);
  if (!slot) throw appError_('QUOTE_MEDIA_NOT_FOUND', 'No existe esa referencia en la cotización.', 404);
  return slot;
}
function qmdIsPdf_(slot) { return slot.Tipo === 'COTIZACION'; }
function qmdMax_(slot) { return qmdIsPdf_(slot) ? ORDER_MEDIA_LIMITS_.pdfBytes : ORDER_MEDIA_LIMITS_.bytes; }
function qmdPlanHash_(slot) { return qmdIsPdf_(slot) ? sha256_(slot.Plan_JSON) : slot.Hash_SHA256; }

function qmdDownload_(slot) {
  var meta = mdMeta_(slot.File_ID);
  mdVerifyMeta_(meta, slot.File_ID, slot.Nombre, slot.Mime_Type, slot.Parent_ID, qmdPlanHash_(slot));
  var max = qmdMax_(slot);
  if (Number(meta.size) > max) throw appError_('QUOTE_MEDIA_INVALID', 'El archivo de Drive excede el límite.', 413);
  var bytes = mdDrive_('drive/v3/files/' + encodeURIComponent(slot.File_ID) + '?alt=media').getBlob().getBytes();
  if (bytes.length > max || !mdMagic_(bytes, slot.Mime_Type)) throw appError_('QUOTE_MEDIA_INVALID', 'El contenido de Drive no coincide con su tipo.', 409);
  if ((qmdIsPdf_(slot) ? slot.Estado === 'LISTO' : true) && (bytes.length !== Number(slot.Bytes) || mdBytesHash_(bytes) !== slot.Hash_SHA256)) {
    throw appError_('QUOTE_MEDIA_HASH_MISMATCH', 'El archivo cambió o quedó incompleto.', 409);
  }
  return bytes;
}

function qmdStore_(slot, bytes) {
  mdEnsureFolder_(slot.Parent_ID);
  try { return qmdDownload_(slot); }
  catch (error) { if (error.appCode !== 'DRIVE_REQUEST_FAILED' || error.details && error.details.status !== 404) throw error; }
  var boundary = 'maddy_quote_' + Utilities.getUuid().replace(/-/g, '');
  var metadata = {
    id: slot.File_ID,
    name: slot.Nombre,
    parents: [slot.Parent_ID],
    mimeType: slot.Mime_Type,
    appProperties: { maddyScope: mdScope_(), maddyPlan: qmdPlanHash_(slot) }
  };
  var start = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)
    + '\r\n--' + boundary + '\r\nContent-Type: ' + slot.Mime_Type + '\r\n\r\n';
  var body = Utilities.newBlob(start).getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  try { mdDrive_('upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: body }); }
  catch (error) { /* Exact-ID readback decides whether Drive committed. */ }
  return qmdDownload_(slot);
}

function qmdReadyRequests_(slot, bytes) {
  var url = mdFileUrl_(slot.File_ID);
  var documentRow = mdUnique_(listRows_('Documentos'), 'ID_Documento', slot.Archivo_ID);
  if (!documentRow) throw appError_('QUOTE_DOCUMENT_INTEGRITY_ERROR', 'Falta el registro reservado del documento.', 409);
  return orderUpdateRequests_('Archivos_Cotizacion', slot._row, { Estado: 'LISTO', URL: url, Bytes: bytes.length, Hash_SHA256: mdBytesHash_(bytes) })
    .concat(orderUpdateRequests_('Documentos', documentRow._row, { URL: url, Hash_SHA256: mdBytesHash_(bytes), Activo: 'SI', Fecha_Emision: slot.Fecha_Registro }));
}

function qmdPlan_(draft, result, session, stamp) {
  qmdSchema_();
  var rootId = requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID');
  var root = mdMeta_(rootId);
  if (root.trashed || root.mimeType !== 'application/vnd.google-apps.folder' || root.name !== '02_DOCUMENTOS_CLIENTES') throw appError_('DRIVE_ROOT_MISMATCH', 'La raíz documental no corresponde a Maderarte.', 503);
  var photoCount = draft.items.reduce(function(sum, item) { return sum + (item.photos || []).length; }, 0);
  var photoBytes = draft.items.reduce(function(sum, item) { return sum + (item.photos || []).reduce(function(n, photo) { return n + photo.size; }, 0); }, 0);
  if (photoCount > ORDER_MEDIA_LIMITS_.count || photoBytes > ORDER_MEDIA_LIMITS_.totalBytes) quoteInputError_('items.photos', 'Las referencias exceden el límite documental.');
  var ids = mdIds_(photoCount + 8);
  var folders = listRows_('Carpetas_Documentales');
  var additions = [];
  function folder(key, name, parent, reuseParent) {
    var found = mdUnique_(folders.concat(additions), 'Clave', key);
    if (found) {
      if (!found.File_ID || (!reuseParent && found.Parent_ID !== parent)) throw appError_('QUOTE_DOCUMENT_INTEGRITY_ERROR', 'La carpeta reservada no coincide con su ubicación.', 409);
      return found.File_ID;
    }
    var id = ids.shift() || mdIds_(1)[0];
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
  var clientKey = scope + ':C:' + year + ':' + sha256_(draft.client.document).slice(0, 32);
  var clientId = folder(clientKey, 'CC-' + draft.client.document + ' - ' + draft.client.name, monthId, true);
  var quotesId = folder(clientKey + ':QUOTES', '00_COTIZACIONES', clientId);
  var quoteId = folder(scope + ':QUOTE:' + result.number, result.number, quotesId);
  var files = [];
  draft.items.forEach(function(item) {
    (item.photos || []).forEach(function(photo) {
      var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[photo.mime];
      files.push({
        Archivo_ID: result.number + '-I-' + item.clientLineId + '-F-' + photo.id,
        Numero_Cotizacion: result.number,
        Item_ID: item.clientLineId,
        Foto_ID: photo.id,
        Tipo: 'FOTO',
        Nombre: result.number + '-' + item.position + '-' + photo.position + '.' + ext,
        Mime_Type: photo.mime,
        Bytes: photo.size,
        Hash_SHA256: photo.sha256,
        File_ID: ids.shift() || mdIds_(1)[0],
        Parent_ID: quoteId,
        Estado: 'PENDIENTE',
        Version: 1,
        Creado_Por: session.profile.uid,
        Request_ID: result.requestId,
        Fecha_Registro: stamp,
        Plan_JSON: JSON.stringify({ originalName: photo.name, position: photo.position })
      });
    });
  });
  var publicData = {
    documentKind: 'quote', issued: true, number: result.number, date: stamp, advisor: session.profile.name || '', branchCode: draft.branch,
    client: draft.client, notes: draft.notes, items: draft.items, subtotal: draft.subtotal, discount: draft.discount, total: draft.total,
    folders: { client: clientId, quote: quoteId }
  };
  if (typeof osActive_ === 'function' && osActive_()) publicData.sandbox = OWNER_SANDBOX_CONTEXT_.id;
  files.push({
    Archivo_ID: result.number + '-PDF-V1', Numero_Cotizacion: result.number, Tipo: 'COTIZACION', Nombre: result.number + '.pdf', Mime_Type: 'application/pdf',
    File_ID: ids.shift() || mdIds_(1)[0], Parent_ID: quoteId, Estado: 'PENDIENTE', Version: 1, Creado_Por: session.profile.uid,
    Request_ID: result.requestId, Fecha_Registro: stamp, Plan_JSON: JSON.stringify(publicData)
  });
  if (files.some(function(file) { return String(file.Plan_JSON || '').length > 50000; })) quoteInputError_('items', 'El documento es demasiado extenso para conservar su versión íntegra.');
  var requests = [];
  if (additions.length) requests.push(orderAppendRequest_('Carpetas_Documentales', additions));
  requests.push(orderAppendRequest_('Archivos_Cotizacion', files));
  requests.push(orderAppendRequest_('Documentos', files.map(function(file) {
    return {
      ID_Documento: file.Archivo_ID,
      Tipo_Documento: file.Tipo === 'COTIZACION' ? 'COTIZACION' : 'COT_FOTO',
      Numero_Relacionado: result.number,
      Cedula_NIT: draft.client.document,
      Nombre_Cliente: draft.client.name,
      Nombre_Archivo: file.Nombre,
      File_ID: file.File_ID,
      Mime_Type: file.Mime_Type,
      Version: 1,
      Activo: 'NO',
      Fecha_Registro: stamp,
      Operador: session.profile.uid,
      Request_ID: result.requestId
    };
  })));
  var pdf = files[files.length - 1];
  requests.push(orderAppendRequest_('Versiones_Documentos', [{
    Version_ID: pdf.Archivo_ID, Tipo_Documento: 'COTIZACION', Numero_Relacionado: result.number, Version: 1, Activo: 'NO',
    File_ID: pdf.File_ID, Nombre_Archivo: pdf.Nombre, Generado_Por: session.profile.uid, Request_ID: result.requestId
  }]));
  result.mediaWorkflow = 1;
  return requests;
}

function qmdAccess_(number, context, write) {
  var session = validateSessionToken_(context.sessionToken, false);
  requirePermission_(session, 'cotizaciones.read');
  var row = mdUnique_(listRows_('Cotizaciones'), 'Numero_Cotizacion', number);
  if (!row) throw appError_('QUOTE_NOT_FOUND', 'No se encontró la cotización.', 404);
  var all = session.permissions.indexOf('*') !== -1;
  var branches = session.profile && session.profile.branches || [];
  if (!all && branches.indexOf(row.Sede) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  if (write) {
    requirePermission_(session, 'cotizaciones.create');
    if (!all && row.Creado_Por !== session.profile.uid && session.permissions.indexOf('cotizaciones.update.all') === -1) throw appError_('QUOTE_DOCUMENT_FORBIDDEN', 'Solo el responsable o un administrador puede completar estos documentos.', 403);
    if (!(typeof osActive_ === 'function' && osActive_()) && (!quoteWritesEnabled_() || optionalProperty_('QUOTE_DOCUMENTS_ENABLED', 'NO') !== 'SI')) {
      throw appError_('QUOTE_DOCUMENT_WRITES_DISABLED', 'La finalización documental de cotizaciones todavía no está habilitada.', 403);
    }
  }
  qmdSchema_();
  return { row: row, session: session };
}

function qmdLocked_(run) {
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('QUOTE_DOCUMENT_BUSY', 'Hay otra operación documental en curso. Consulta su resultado.', 503);
  try { return run(); } finally { lock.releaseLock(); }
}

function qmdStatus_(number, context) {
  qmdAccess_(number, context, false);
  var files = qmdRows_(number);
  return {
    number: number,
    complete: files.some(function(row) { return row.Tipo === 'COTIZACION'; }) && files.every(function(row) { return row.Estado === 'LISTO' && row.URL; }),
    files: files.map(function(row) {
      var plan = row.Tipo === 'FOTO' ? parseJson_(row.Plan_JSON, {}) : {};
      return {
        id: row.Archivo_ID,
        itemId: row.Item_ID || '',
        photoId: row.Foto_ID || '',
        type: row.Tipo,
        name: plan.originalName || row.Nombre,
        position: plan.position || 0,
        mime: row.Mime_Type,
        size: Number(row.Bytes) || 0,
        sha256: row.Hash_SHA256 || '',
        ready: row.Estado === 'LISTO',
        url: row.Estado === 'LISTO' ? row.URL : ''
      };
    })
  };
}

function qmdUploadPhoto_(payload, context) {
  return qmdLocked_(function() {
    qmdAccess_(payload.number, context, true);
    var slot = qmdSlot_(payload.number, payload.id);
    if (slot.Tipo !== 'FOTO') throw appError_('QUOTE_MEDIA_INVALID', 'Este espacio no corresponde a una fotografía.', 400);
    var bytes = mdDecode_(payload.base64, ORDER_MEDIA_LIMITS_.bytes);
    if (bytes.length !== Number(slot.Bytes) || mdBytesHash_(bytes) !== slot.Hash_SHA256 || !mdMagic_(bytes, slot.Mime_Type)) throw appError_('QUOTE_MEDIA_HASH_MISMATCH', 'La fotografía no coincide con la cotización confirmada.', 409);
    var stored = qmdStore_(slot, bytes);
    orderAtomicBatch_(qmdReadyRequests_(slot, stored));
    return { number: payload.number, id: slot.Archivo_ID, ready: true };
  });
}

function qmdReadPhoto_(payload, context) {
  qmdAccess_(payload.number, context, false);
  var slot = qmdSlot_(payload.number, payload.id);
  if (slot.Tipo !== 'FOTO' || slot.Estado !== 'LISTO') throw appError_('QUOTE_MEDIA_NOT_READY', 'La fotografía aún no está confirmada.', 409);
  return { id: slot.Archivo_ID, dataUrl: 'data:' + slot.Mime_Type + ';base64,' + Utilities.base64Encode(qmdDownload_(slot)) };
}

function qmdPreparePdf_(payload, context) {
  mdInternal_(context);
  return qmdLocked_(function() {
    var access = qmdAccess_(payload.number, context, true);
    var files = qmdRows_(payload.number);
    var slot = mdUnique_(files, 'Tipo', 'COTIZACION');
    if (!slot) throw appError_('QUOTE_DOCUMENT_NOT_PLANNED', 'Esta cotización no tiene un plan documental reservado.', 409);
    if (slot.Estado === 'LISTO') {
      qmdDownload_(slot);
      return { complete: true, number: payload.number, pdfUrl: slot.URL };
    }
    var data = parseJson_(slot.Plan_JSON, null);
    if (!data || data.number !== payload.number || data.total !== Number(access.row.Total_Cotizado) || data.documentKind !== 'quote') {
      throw appError_('QUOTE_DOCUMENT_INTEGRITY_ERROR', 'El documento no coincide con la cotización confirmada.', 409);
    }
    mdEnsureFolder_(slot.Parent_ID);
    data.items = data.items.map(function(item) {
      return Object.assign({}, item, { photos: (item.photos || []).map(function(photo) {
        var file = mdUnique_(files, 'Archivo_ID', payload.number + '-I-' + item.clientLineId + '-F-' + photo.id);
        if (!file || file.Estado !== 'LISTO') throw appError_('QUOTE_PHOTOS_PENDING', 'Faltan fotografías por confirmar; se conserva la cotización.', 409);
        return 'data:' + file.Mime_Type + ';base64,' + Utilities.base64Encode(qmdDownload_(file));
      }) });
    });
    delete data.folders;
    return { complete: false, number: payload.number, id: slot.Archivo_ID, planHash: sha256_(slot.Plan_JSON), document: data };
  });
}

function qmdConfirmPdf_(payload, context) {
  mdInternal_(context);
  return qmdLocked_(function() {
    var access = qmdAccess_(payload.number, context, true);
    var slot = qmdSlot_(payload.number, payload.id);
    if (slot.Tipo !== 'COTIZACION' || sha256_(slot.Plan_JSON) !== payload.planHash) throw appError_('QUOTE_DOCUMENT_REVISION_CHANGED', 'La versión documental no coincide.', 409);
    var bytes = mdDecode_(payload.base64, ORDER_MEDIA_LIMITS_.pdfBytes);
    if (!mdMagic_(bytes, 'application/pdf')) throw appError_('PDF_INVALID', 'El generador no entregó un PDF válido.', 502);
    var stored = qmdStore_(slot, bytes);
    var data = parseJson_(slot.Plan_JSON, null);
    var requests = qmdReadyRequests_(slot, stored);
    var client = mdUnique_(listRows_('Clientes'), 'Cedula_NIT', access.row.Cedula_NIT);
    var version = mdUnique_(listRows_('Versiones_Documentos'), 'Version_ID', slot.Archivo_ID);
    if (!client || !version) throw appError_('QUOTE_DOCUMENT_INTEGRITY_ERROR', 'Falta una referencia documental reservada.', 409);
    requests = requests.concat(
      orderUpdateRequests_('Cotizaciones', access.row._row, {
        URL_PDF_Cotizacion: mdFileUrl_(slot.File_ID),
        URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client),
        URL_Carpeta_Mes: mdFolderUrl_(data.folders.quote),
        Actualizado_Por: access.session.profile.uid,
        Actualizado_En: now_().toISOString()
      }),
      orderUpdateRequests_('Clientes', client._row, { URL_Carpeta_Cliente: mdFolderUrl_(data.folders.client) }),
      orderUpdateRequests_('Versiones_Documentos', version._row, {
        URL: mdFileUrl_(slot.File_ID), Hash_SHA256: mdBytesHash_(stored), Activo: 'SI', Fecha_Generacion: slot.Fecha_Registro
      })
    );
    orderAtomicBatch_(requests);
    return { complete: true, number: payload.number, pdfUrl: mdFileUrl_(slot.File_ID), folderUrl: mdFolderUrl_(data.folders.quote) };
  });
}

function qmdReadPdf_(payload, context) {
  qmdAccess_(payload.number, context, false);
  var slot = mdUnique_(qmdRows_(payload.number), 'Tipo', 'COTIZACION');
  if (!slot || slot.Estado !== 'LISTO') throw appError_('QUOTE_PDF_PENDING', 'El PDF todavía está pendiente.', 409);
  return { name: slot.Nombre, mime: 'application/pdf', base64: Utilities.base64Encode(qmdDownload_(slot)) };
}

function getQuote_(payload, session) {
  requirePermission_(session, 'cotizaciones.read');
  var number = String(payload && payload.number || '').trim();
  var row = mdUnique_(listRows_('Cotizaciones'), 'Numero_Cotizacion', number);
  if (!row) throw appError_('QUOTE_NOT_FOUND', 'No se encontró la cotización.', 404);
  var all = session.permissions.indexOf('*') !== -1;
  var branches = session.profile && session.profile.branches || [];
  if (!all && branches.indexOf(row.Sede) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  var result = normalizeQuote_(row);
  result.clientDetail = normalizeClient_(findRow_('Clientes', 'Cedula_NIT', row.Cedula_NIT) || {});
  result.documents = qmdConfigured_() ? qmdStatus_(number, { sessionToken: '', session: session, proxyMeta: {} }) : { number: number, complete: Boolean(row.URL_PDF_Cotizacion), files: [] };
  return result;
}

function prepararDocumentosCotizaciones() {
  return qmdLocked_(function() {
    if (MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', '') !== 'PREPARACION') throw appError_('SCHEMA_SETUP_NOT_ALLOWED', 'La preparación exige operación comercial deshabilitada.', 403);
    mdSchema_();
    var ss = getSpreadsheet_();
    var name = 'Archivos_Cotizacion';
    var headers = QUOTE_MEDIA_HEADERS_.Archivos_Cotizacion;
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      var used = ss.getSheets().map(function(tab) { return tab.getSheetId(); });
      var id = 2110001022;
      while (used.indexOf(id) !== -1) id++;
      orderAtomicBatch_([
        { addSheet: { properties: { sheetId: id, title: name, gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 20), frozenRowCount: 1 } } } },
        { updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 }, rows: [{ values: headers.map(orderCell_) }], fields: 'userEnteredValue' } }
      ]);
    } else if (JSON.stringify(getHeaders_(sheet)) !== JSON.stringify(headers)) {
      throw appError_('SHEET_SCHEMA_MISMATCH', 'Archivos_Cotizacion no coincide con el contrato.', 409);
    }
    getScriptProperties_().setProperty('QUOTE_DOCUMENTS_SCHEMA_VERSION', '1');
    qmdSchema_();
    return { ok: true, quoteDocumentSheet: name, commercialWrites: false, enabled: false };
  });
}
