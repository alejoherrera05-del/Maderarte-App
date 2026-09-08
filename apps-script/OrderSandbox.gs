// Owner-only acceptance environment. No global switch or production property is
// changed. Every request is authenticated against the ORIGINAL identity tables.
var OWNER_SANDBOX_CONTEXT_ = null; // execution-local, never supplied by a client
var OWNER_SANDBOX_KEY_ = 'MADDY_OWNER_SANDBOX_V1';
var OWNER_SANDBOX_ACTIONS_ = Object.freeze(['COTIZACION_META', 'CLIENTES_LISTAR', 'CLIENTE_OBTENER',
  'COTIZACION_OBTENER', 'COTIZACION_CAPACIDADES', 'COTIZACION_CREAR', 'COTIZACION_CREACION_ESTADO',
  'COTIZACION_DOCUMENTOS_ESTADO', 'COTIZACION_FOTO_GUARDAR', 'COTIZACION_FOTO_LEER', 'COTIZACION_PDF_LEER',
  'INTERNO_COTIZACION_DOCUMENTO_PREPARAR', 'INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR',
  'ORDEN_CAPACIDADES', 'ORDEN_CREAR', 'ORDEN_CREACION_ESTADO', 'ORDEN_OBTENER',
  'ORDEN_DOCUMENTOS_ESTADO', 'ORDEN_FOTO_GUARDAR', 'ORDEN_FOTO_LEER', 'ORDEN_PDF_LEER',
  'INTERNO_DOCUMENTO_PREPARAR', 'INTERNO_DOCUMENTO_CONFIRMAR']);

function osFail_(code, message) { throw appError_(code, message, 409); }
function osProperty_(name) { return String(getScriptProperties_().getProperty(name) || ''); }
function osState_() {
  var raw = osProperty_(OWNER_SANDBOX_KEY_);
  if (!raw) return null;
  var s = parseJson_(raw, null);
  if (!s || !/^QA-[a-f0-9]{32}$/.test(s.id || '') || !s.uid || !s.containerId || !s.rootId
    || !['PREPARANDO', 'ACTIVA', 'LIMPIANDO', 'CERRADA'].includes(s.stage)) {
    osFail_('SANDBOX_RECOVERY_REQUIRED', 'El registro del ensayo requiere revisión. No borres propiedades.');
  }
  return s;
}
function osStore_(s) {
  var value = JSON.stringify(s);
  if (value.length > 8500) osFail_('SANDBOX_RECOVERY_REQUIRED', 'El registro del ensayo supera su límite.');
  getScriptProperties_().setProperty(OWNER_SANDBOX_KEY_, value);
  if (osProperty_(OWNER_SANDBOX_KEY_) !== value) osFail_('SANDBOX_RECOVERY_REQUIRED', 'No se pudo asegurar la recuperación del ensayo.');
}
function osOwner_(context) {
  var session = validateSessionToken_(context.sessionToken, false);
  if (session.profile.role !== 'PROPIETARIO' || session.profile.status && session.profile.status !== 'ACTIVO') {
    throw appError_('SANDBOX_OWNER_ONLY', 'El ensayo está disponible únicamente para el propietario activo.', 403);
  }
  requirePermission_(session, 'config.read');
  return session;
}
function osProductionClosed_() {
  if (OWNER_SANDBOX_CONTEXT_ || MADERARTE_APP.COMMERCIAL_WRITES !== false || getConfigValue_('MODO_OPERACION', '') !== 'PREPARACION') {
    osFail_('SANDBOX_PREPARATION_ONLY', 'El ensayo exige mantener la operación original en PREPARACION.');
  }
}
function osLock_(run) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) osFail_('SANDBOX_BUSY', 'Hay una operación en curso. Consulta el mismo ensayo.');
  try { return run(); } finally { OWNER_SANDBOX_CONTEXT_ = null; lock.releaseLock(); }
}
function osOperationLock_() {
  if (OWNER_SANDBOX_CONTEXT_) return { tryLock: function() { return true; }, releaseLock: function() {} };
  return LockService.getScriptLock();
}
function osActive_() { return !!OWNER_SANDBOX_CONTEXT_ && OWNER_SANDBOX_CONTEXT_.stage === 'ACTIVA'; }
function osScopedProperty_(name) {
  if (!OWNER_SANDBOX_CONTEXT_) return null;
  if (name === 'SPREADSHEET_ID') return OWNER_SANDBOX_CONTEXT_.sheetId;
  if (name === 'DRIVE_DOCUMENTS_ROOT_ID') return OWNER_SANDBOX_CONTEXT_.rootId;
  return null;
}
function osAuthSheet_(name) {
  if (!OWNER_SANDBOX_CONTEXT_ || !['Usuarios', 'Roles', 'Sesiones', 'Invitaciones'].includes(name)) return null;
  var sheet = SpreadsheetApp.openById(osProperty_('SPREADSHEET_ID')).getSheetByName(name);
  if (!sheet) osFail_('SANDBOX_AUTH_SOURCE_MISSING', 'Falta una tabla de identidad en la base original. No se usará la del ensayo.');
  return sheet;
}
function osDatabaseName_() { return OWNER_SANDBOX_CONTEXT_ ? OWNER_SANDBOX_CONTEXT_.sheetName : MADERARTE_APP.SPREADSHEET_NAME; }
function osFenceKey_() { return 'ORDER_CREATION_PENDING' + (OWNER_SANDBOX_CONTEXT_ ? ':' + OWNER_SANDBOX_CONTEXT_.id : ''); }
function osQuoteFenceKey_() { return 'QUOTE_CREATION_PENDING' + (OWNER_SANDBOX_CONTEXT_ ? ':' + OWNER_SANDBOX_CONTEXT_.id : ''); }
function osMarker_(s, role) { return { maddySandbox: s.id, maddySandboxRole: role }; }
function osMeta_(id) {
  return JSON.parse(mdDrive_('drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,mimeType,parents,trashed,appProperties').getContentText());
}
function osExpect_(meta, s, role, parent) {
  if (!meta || meta.id === osProperty_('SPREADSHEET_ID') || meta.id === osProperty_('DRIVE_DOCUMENTS_ROOT_ID')
    || meta.appProperties?.maddySandbox !== s.id || meta.appProperties?.maddySandboxRole !== role
    || parent && !(meta.parents || []).includes(parent)) {
    osFail_('SANDBOX_IDENTITY_MISMATCH', 'El recurso no pertenece a este ensayo. No se modificó.');
  }
}
function osFolder_(s, id, name, parent, role) {
  var meta;
  try { meta = osMeta_(id); }
  catch (error) {
    if (error.details?.status !== 404) throw error;
    try { mdDrive_('drive/v3/files?fields=id', { method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ id: id, name: name, mimeType: 'application/vnd.google-apps.folder', parents: [parent], appProperties: osMarker_(s, role) }) }); }
    catch (ignored) { /* Exact-ID readback resolves a lost response; no second ID. */ }
    meta = osMeta_(id);
  }
  osExpect_(meta, s, role, parent);
  if (meta.trashed || meta.name !== name || meta.mimeType !== 'application/vnd.google-apps.folder') osFail_('SANDBOX_IDENTITY_MISMATCH', 'La carpeta de ensayo cambió. Requiere revisión.');
}
function osList_(query) {
  var all = [], page = '';
  do {
    var result = JSON.parse(mdDrive_('drive/v3/files?q=' + encodeURIComponent(query) + '&pageSize=100&fields=nextPageToken,files(id,name,mimeType,parents,trashed,appProperties)' + (page ? '&pageToken=' + encodeURIComponent(page) : '')).getContentText());
    all = all.concat(result.files || []); page = result.nextPageToken || '';
    if (all.length > 150) osFail_('SANDBOX_LIMIT', 'El ensayo contiene más archivos de los previstos. Requiere revisión.');
  } while (page);
  return all;
}
function osEnsureSheet_(s) {
  if (!s.sheetId) {
    var query = "'" + s.containerId + "' in parents and trashed = false and appProperties has { key='maddySandbox' and value='" + s.id + "' } and mimeType='application/vnd.google-apps.spreadsheet'";
    var found = osList_(query);
    if (found.length > 1) osFail_('SANDBOX_RECOVERY_REQUIRED', 'Hay más de una hoja candidata. Requiere revisión.');
    if (found.length === 1) s.sheetId = found[0].id;
    else if (s.sheetCreationSent) osFail_('SANDBOX_PROVISION_UNCERTAIN', 'Google aún no confirma la hoja de prueba. Vuelve a consultar; no se creará otra.');
    else {
      s.sheetCreationSent = true; osStore_(s);
      var result;
      try { result = JSON.parse(mdDrive_('drive/v3/files?fields=id', { method: 'post', contentType: 'application/json', payload: JSON.stringify({
        name: s.sheetName, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [s.containerId], appProperties: osMarker_(s, 'sheet')
      }) }).getContentText()); }
      catch (error) { osFail_('SANDBOX_PROVISION_UNCERTAIN', 'Falta confirmar la hoja de prueba. Consulta el mismo ensayo; no se creará otra.'); }
      if (!result.id) osFail_('SANDBOX_PROVISION_UNCERTAIN', 'Falta confirmar la hoja de prueba.');
      s.sheetId = result.id;
    }
    osStore_(s);
  }
  var meta = osMeta_(s.sheetId); osExpect_(meta, s, 'sheet', s.containerId);
  if (meta.trashed || meta.name !== s.sheetName || meta.mimeType !== 'application/vnd.google-apps.spreadsheet') osFail_('SANDBOX_IDENTITY_MISMATCH', 'La hoja de ensayo cambió.');
}
function osSchemas_() {
  var schemas = {};
  Object.keys(REQUIRED_HEADERS).forEach(function(name) { schemas[name] = REQUIRED_HEADERS[name].concat(ORDER_CREATION_EXTRA_HEADERS_[name] || []); });
  Object.keys(ORDER_MEDIA_HEADERS_).forEach(function(name) { schemas[name] = ORDER_MEDIA_HEADERS_[name]; });
  if (typeof QUOTE_MEDIA_HEADERS_ !== 'undefined') Object.keys(QUOTE_MEDIA_HEADERS_).forEach(function(name) { schemas[name] = QUOTE_MEDIA_HEADERS_[name]; });
  return schemas;
}
function osSeed_(s, branches) {
  var ss = SpreadsheetApp.openById(s.sheetId), schemas = osSchemas_(), requests = [], used = ss.getSheets().map(function(t) { return t.getSheetId(); });
  var tabs = ss.getSheets();
  tabs.forEach(function(tab) {
    if (!schemas[tab.getName()]) {
      if (tab.getLastRow() || tab.getLastColumn()) osFail_('SANDBOX_SCHEMA_UNEXPECTED', 'La hoja nueva contiene datos no esperados.');
      requests.push({ deleteSheet: { sheetId: tab.getSheetId() } });
    }
  });
  var removeDefaults = requests; requests = [];
  Object.keys(schemas).forEach(function(name, index) {
    var headers = schemas[name], tab = ss.getSheetByName(name), id = tab ? tab.getSheetId() : 1900000000 + index;
    while (!tab && used.includes(id)) id++;
    used.push(id);
    if (tab) {
      if (JSON.stringify(getHeaders_(tab)) !== JSON.stringify(headers)) osFail_('SANDBOX_SCHEMA_UNEXPECTED', 'Encabezados inesperados en ' + name + '.');
      if (tab.getLastRow() > 1 && !['Sedes', 'Configuracion'].includes(name)) osFail_('SANDBOX_SCHEMA_UNEXPECTED', 'La preparación encontró registros ajenos.');
    } else {
      requests.push({ addSheet: { properties: { sheetId: id, title: name, gridProperties: { rowCount: 100, columnCount: Math.max(headers.length, 20), frozenRowCount: 1 } } } });
      requests.push({ updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 }, rows: [{ values: headers.map(orderCell_) }], fields: 'userEnteredValue' } });
      requests.push({ repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: .94, green: .94, blue: .94 }, textFormat: { bold: true }, wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat' } } });
    }
    var rows = [];
    if (name === 'Configuracion') rows = [{ Clave: 'MODO_OPERACION', Valor: 'PREPARACION' }];
    if (name === 'Sedes') rows = branches.map(function(b) {
      var prefix = b.Sede_ID + '-QA-' + s.id.slice(-8).toUpperCase();
      return { Sede_ID: b.Sede_ID, Nombre: b.Nombre, Direccion: b.Direccion || '', Telefono: b.Telefono || '', Estado: 'ACTIVA',
        Prefijo_OP: prefix + '-OP', Prefijo_Cotizacion: prefix + '-COT', Prefijo_Recibo: prefix + '-RC', Prefijo_Remision: prefix + '-REM',
        Siguiente_OP: 1, Siguiente_Cotizacion: 1, Siguiente_Recibo: 1, Siguiente_Remision: 1 };
    });
    if (rows.length) requests.push({ updateCells: { start: { sheetId: id, rowIndex: 1, columnIndex: 0 }, rows: rows.map(function(row) { return { values: headers.map(function(h) { return orderCell_(row[h]); }) }; }), fields: 'userEnteredValue' } });
  });
  requests = requests.concat(removeDefaults);
  OWNER_SANDBOX_CONTEXT_ = s;
  try {
    orderAtomicBatch_(requests);
    var verify = SpreadsheetApp.openById(s.sheetId);
    Object.keys(schemas).forEach(function(name) {
      var tab = verify.getSheetByName(name);
      if (!tab || JSON.stringify(getHeaders_(tab)) !== JSON.stringify(schemas[name])) osFail_('SANDBOX_SCHEMA_UNCONFIRMED', 'Falta confirmar la estructura del ensayo.');
    });
  } finally { OWNER_SANDBOX_CONTEXT_ = null; }
}
function osPublic_(s) {
  if (!s) return { available: true, state: 'SIN_PRUEBA', productionWrites: false };
  var result = { available: true, id: s.id, state: s.stage, productionWrites: false, number: s.number || '', quoteNumber: s.quoteNumber || '', closedAt: s.closedAt || '',
    folderUrl: 'https://drive.google.com/drive/folders/' + s.containerId,
    sheetUrl: s.sheetId ? 'https://docs.google.com/spreadsheets/d/' + s.sheetId + '/edit' : '', cleanupConfirmed: s.stage === 'CERRADA' };
  if (s.stage === 'ACTIVA') {
    OWNER_SANDBOX_CONTEXT_ = s;
    try {
      var orders = listRows_('Ordenes_Pedido'), quotes = listRows_('Cotizaciones');
      result.number = orders.length === 1 ? orders[0].Numero_OP : '';
      result.quoteNumber = quotes.length === 1 ? quotes[0].Numero_Cotizacion : '';
      result.documentStatus = orders.length === 1 ? orders[0].Estado_Documentos : '';
      result.quoteDocumentStatus = quotes.length === 1 ? (String(quotes[0].URL_PDF_Cotizacion || '').trim() ? 'COMPLETO' : 'PENDIENTE') : '';
      result.counts = { orders: orders.length, quotes: quotes.length, items: countRows_('Orden_Items'), payments: countRows_('Abonos'), documents: countRows_('Documentos') };
      var noOrderFence = !readOrderFence_(), noQuoteFence = !readQuoteFence_();
      var orderReady = orders.length === 1 && orders[0].Estado_Documentos === 'COMPLETO' && quotes.length === 0;
      var quoteReady = quotes.length === 1 && String(quotes[0].URL_PDF_Cotizacion || '').trim() && orders.length === 0;
      var empty = !orders.length && !quotes.length && !s.requestId && !s.quoteRequestId;
      result.canClean = noOrderFence && noQuoteFence && (empty || orderReady || quoteReady);
    } finally { OWNER_SANDBOX_CONTEXT_ = null; }
  }
  return result;
}
function osStart_(payload, context) {
  orderObject_(payload, ['confirm'], 'sandbox');
  if (payload.confirm !== 'CREAR PRUEBA AISLADA') osFail_('SANDBOX_CONFIRM_REQUIRED', 'Confirma que crearás una prueba aislada.');
  return osLock_(function() {
    var session = osOwner_(context); osProductionClosed_(); orderCreationSchemaReady_(); mdSchema_(); quoteCreationSchemaReady_(); qmSchema_();
    var s = osState_();
    if (s && s.uid !== session.profile.uid) throw appError_('SANDBOX_OWNER_ONLY', 'Este ensayo pertenece a otro propietario.', 403);
    if (s && s.stage === 'LIMPIANDO') osFail_('SANDBOX_CLEANUP_PENDING', 'Completa la limpieza del ensayo anterior.');
    if (s && s.stage === 'ACTIVA') return osPublic_(s);
    if (!s || s.stage === 'CERRADA') {
      var productionRoot = osMeta_(osProperty_('DRIVE_DOCUMENTS_ROOT_ID'));
      if (productionRoot.trashed || productionRoot.name !== '02_DOCUMENTOS_CLIENTES' || productionRoot.parents?.length !== 1) osFail_('SANDBOX_ROOT_MISMATCH', 'Revisa la raíz documental original.');
      var parent = osMeta_(productionRoot.parents[0]);
      if (parent.trashed || parent.name !== 'MADERARTE APP' || parent.mimeType !== 'application/vnd.google-apps.folder') osFail_('SANDBOX_ROOT_MISMATCH', 'No se identificó la raíz MADERARTE APP.');
      var id = 'QA-' + Utilities.getUuid().replace(/-/g, '').toLowerCase(), ids = mdIds_(2);
      s = { id: id, uid: session.profile.uid, stage: 'PREPARANDO', parentId: parent.id, containerId: ids[0], rootId: ids[1],
        sheetName: 'Maddy - PRUEBA AISLADA - ' + id, createdAt: now_().toISOString(), sheetId: '', sheetCreationSent: false };
      osStore_(s);
    }
    osFolder_(s, s.containerId, '99_PRUEBA_PEDIDO_' + s.id, s.parentId, 'container');
    osFolder_(s, s.rootId, '02_DOCUMENTOS_CLIENTES', s.containerId, 'root');
    osEnsureSheet_(s);
    var branches = listRows_('Sedes').filter(function(b) { return ['MP', 'TP'].includes(b.Sede_ID) && b.Estado === 'ACTIVA'; });
    if (!branches.length) osFail_('SANDBOX_BRANCH_REQUIRED', 'No hay una sede activa para el ensayo.');
    osSeed_(s, branches);
    s.stage = 'ACTIVA'; osStore_(s);
    return osPublic_(s);
  });
}
function osStatus_(context) {
  return osLock_(function() {
    var session = osOwner_(context), s = osState_();
    if (s && s.uid !== session.profile.uid) throw appError_('SANDBOX_OWNER_ONLY', 'Este ensayo pertenece a otro propietario.', 403);
    return osPublic_(s);
  });
}
function osAdmit_(id, action, context, run) {
  if (typeof id !== 'string' || !/^QA-[a-f0-9]{32}$/.test(id) || !OWNER_SANDBOX_ACTIONS_.includes(action)) throw appError_('SANDBOX_ACTION_FORBIDDEN', 'El contexto de prueba no admite esta acción.', 403);
  return osLock_(function() {
    var session = osOwner_(context); osProductionClosed_(); var s = osState_();
    if (!s || s.id !== id || s.uid !== session.profile.uid || s.stage !== 'ACTIVA') osFail_('SANDBOX_CLOSED', 'El ensayo no está activo. Vuelve al control de pruebas.');
    if (!s.sheetId || s.sheetId === osProperty_('SPREADSHEET_ID') || s.rootId === osProperty_('DRIVE_DOCUMENTS_ROOT_ID')) osFail_('SANDBOX_IDENTITY_MISMATCH', 'No se confirmó el aislamiento.');
    var meta = osMeta_(s.sheetId); osExpect_(meta, s, 'sheet', s.containerId);
    var root = osMeta_(s.rootId); osExpect_(root, s, 'root', s.containerId);
    if (meta.trashed || root.trashed) osFail_('SANDBOX_CLOSED', 'El espacio de ensayo está en la papelera.');
    OWNER_SANDBOX_CONTEXT_ = s;
    return run(session);
  });
}
function osValidateDraft_(draft, requestId) {
  if (!osActive_()) return;
  var s = OWNER_SANDBOX_CONTEXT_;
  if (draft.client.document !== '0000000001' || draft.client.name !== 'PRUEBA MADDY - NO ES UNA VENTA'
    || draft.client.phone !== '0000000011' || draft.client.alternatePhone !== '0000000022'
    || draft.client.email !== 'qa@example.invalid' || draft.client.address !== 'SIN ENTREGA - DATOS FICTICIOS' || draft.client.city !== 'Popayán (prueba)') {
    osFail_('SANDBOX_SYNTHETIC_CLIENT_REQUIRED', 'Usa los datos ficticios precargados; no registres un cliente real en el ensayo.');
  }
  if (draft.items.length > 3 || draft.payments.length > 4) osFail_('SANDBOX_LIMIT', 'El ensayo admite hasta tres muebles y cuatro pagos ficticios.');
  if (countRows_('Cotizaciones') > 0 || s.quoteRequestId) osFail_('SANDBOX_ONE_OPERATION', 'Este ensayo ya contiene una cotización. Finalízala y limpia la prueba antes de crear una orden.');
  if (s.requestId && s.requestId !== requestId || !s.requestId && countRows_('Ordenes_Pedido') > 0) osFail_('SANDBOX_ONE_ORDER', 'Este ensayo admite una sola orden. Reabre la existente o finaliza la prueba.');
  draft.notes = '[PRUEBA AISLADA ' + s.id + ' - SIN VALIDEZ COMERCIAL. NO COBRAR, ENTREGAR NI FABRICAR.]\n' + draft.notes;
}
function qsValidateDraft_(draft, requestId) {
  if (!osActive_()) return;
  var s = OWNER_SANDBOX_CONTEXT_;
  if (draft.client.document !== '0000000001' || draft.client.name !== 'PRUEBA MADDY - NO ES UNA VENTA'
    || draft.client.phone !== '0000000011' || draft.client.alternatePhone !== '0000000022'
    || draft.client.email !== 'qa@example.invalid' || draft.client.address !== 'SIN ENTREGA - DATOS FICTICIOS' || draft.client.city !== 'Popayán (prueba)') {
    osFail_('SANDBOX_SYNTHETIC_CLIENT_REQUIRED', 'Usa los datos ficticios precargados; no registres un cliente real en el ensayo.');
  }
  if (draft.items.length > 3) osFail_('SANDBOX_LIMIT', 'El ensayo admite hasta tres muebles en la cotización.');
  if (countRows_('Ordenes_Pedido') > 0 || s.requestId) osFail_('SANDBOX_ONE_OPERATION', 'Este ensayo ya contiene una orden. Finalízala y limpia la prueba antes de emitir una cotización.');
  if (s.quoteRequestId && s.quoteRequestId !== requestId || !s.quoteRequestId && countRows_('Cotizaciones') > 0) osFail_('SANDBOX_ONE_QUOTE', 'Este ensayo admite una sola cotización. Reabre la existente o finaliza la prueba.');
  draft.notes = '[PRUEBA AISLADA ' + s.id + ' - SIN VALIDEZ COMERCIAL.]\n' + draft.notes;
}
function osReserveOrder_(requestId) {
  if (!osActive_()) return;
  var s = OWNER_SANDBOX_CONTEXT_; if (!s.requestId) { s.requestId = requestId; osStore_(s); }
}
function osReserveQuote_(requestId) {
  if (!osActive_()) return;
  var s = OWNER_SANDBOX_CONTEXT_; if (!s.quoteRequestId) { s.quoteRequestId = requestId; osStore_(s); }
}
function osCleanupPlan_(s) {
  var expected = {};
  expected[s.containerId] = { role: 'container', parent: s.parentId };
  expected[s.rootId] = { role: 'root', parent: s.containerId };
  expected[s.sheetId] = { role: 'sheet', parent: s.containerId };
  OWNER_SANDBOX_CONTEXT_ = s;
  try {
    assertNoUnresolvedOrderFence_(); assertNoUnresolvedQuoteFence_();
    var orders = listRows_('Ordenes_Pedido'), quotes = listRows_('Cotizaciones');
    if (orders.length > 1 || quotes.length > 1 || orders.length && quotes.length) osFail_('SANDBOX_ONE_OPERATION', 'El ensayo contiene más de una operación comercial y requiere revisión.');
    if (orders.length === 1 && orders[0].Estado_Documentos !== 'COMPLETO' || !orders.length && s.requestId) {
      osFail_('SANDBOX_DOCUMENTS_PENDING', 'Primero confirma el pedido y completa sus archivos. No se limpiará un guardado incierto.');
    }
    if (quotes.length === 1 && !String(quotes[0].URL_PDF_Cotizacion || '').trim() || !quotes.length && s.quoteRequestId) {
      osFail_('SANDBOX_DOCUMENTS_PENDING', 'Primero confirma la cotización y completa su PDF. No se limpiará una emisión incierta.');
    }
    listRows_('Carpetas_Documentales').forEach(function(r) { expected[r.File_ID] = { role: 'media', parent: r.Parent_ID }; });
    var slots = listRows_('Archivos_Orden').concat(typeof QUOTE_MEDIA_HEADERS_ !== 'undefined' ? listRows_('Archivos_Cotizacion') : []);
    slots.forEach(function(r) { expected[r.File_ID] = { role: 'media', parent: r.Parent_ID }; });
    var candidates = [];
    function visit(id, depth) {
      if (depth > 8) osFail_('SANDBOX_LIMIT', 'La estructura del ensayo no es la esperada.');
      var meta = osMeta_(id), spec = expected[id];
      if (!spec) osFail_('SANDBOX_FOREIGN_FILE', 'Hay un archivo ajeno dentro del ensayo. No se eliminará automáticamente.');
      if (spec.role === 'media') {
        if (meta.appProperties?.maddyScope !== mdScope_() || !(meta.parents || []).includes(spec.parent)) osFail_('SANDBOX_IDENTITY_MISMATCH', 'Un archivo del ensayo cambió de identidad o ubicación.');
      } else osExpect_(meta, s, spec.role, spec.parent);
      if (meta.trashed) osFail_('SANDBOX_RECOVERY_REQUIRED', 'Un archivo ya estaba en la papelera antes de preparar la limpieza.');
      if (meta.mimeType === 'application/vnd.google-apps.folder') osList_("'" + id + "' in parents and trashed = false").forEach(function(child) { visit(child.id, depth + 1); });
      candidates.push({ id: id, parent: spec.parent, role: spec.role, folder: meta.mimeType === 'application/vnd.google-apps.folder' });
    }
    visit(s.containerId, 0);
    var visitedIds = candidates.map(function(entry) { return entry.id; });
    if (slots.some(function(slot) { return slot.Estado !== 'LISTO' || !visitedIds.includes(slot.File_ID); })) osFail_('SANDBOX_IDENTITY_MISMATCH', 'Falta un archivo confirmado dentro del ensayo. No se limpiará parcialmente.');
    if (!candidates.some(function(x) { return x.id === s.sheetId; }) || !candidates.some(function(x) { return x.id === s.rootId; })) osFail_('SANDBOX_IDENTITY_MISMATCH', 'No se encontró el espacio completo.');
    return candidates;
  } finally { OWNER_SANDBOX_CONTEXT_ = null; }
}
function osClean_(payload, context) {
  orderObject_(payload, ['id', 'confirm'], 'cleanup');
  return osLock_(function() {
    var session = osOwner_(context), s = osState_();
    if (!s || payload.id !== s.id || s.uid !== session.profile.uid) throw appError_('SANDBOX_OWNER_ONLY', 'No se identificó tu ensayo.', 403);
    if (payload.confirm !== 'LIMPIAR ' + s.id) osFail_('SANDBOX_CONFIRM_REQUIRED', 'Escribe la confirmación del ensayo exacto.');
    if (s.stage === 'CERRADA') return osPublic_(s);
    osProductionClosed_();
    if (!s.cleanup) {
      if (s.stage !== 'ACTIVA') osFail_('SANDBOX_NOT_READY', 'La preparación no terminó. No se limpiará a ciegas.');
      var files = osCleanupPlan_(s);
      s.cleanup = files; s.stage = 'LIMPIANDO'; osStore_(s);
    }
    var scope = sha256_(s.sheetId).slice(0, 32), allowed = s.cleanup.map(function(x) { return x.id; });
    s.cleanup.forEach(function(entry) {
      var meta = osMeta_(entry.id);
      if (entry.id === osProperty_('SPREADSHEET_ID') || entry.id === osProperty_('DRIVE_DOCUMENTS_ROOT_ID')) osFail_('SANDBOX_IDENTITY_MISMATCH', 'No se tocará la base original.');
      if (entry.role === 'media') {
        if (meta.appProperties?.maddyScope !== scope || !(meta.parents || []).includes(entry.parent)) osFail_('SANDBOX_IDENTITY_MISMATCH', 'Un archivo cambió; la limpieza se detuvo.');
      } else osExpect_(meta, s, entry.role, entry.parent);
      if (meta.trashed) return;
      if (entry.folder && osList_("'" + entry.id + "' in parents and trashed = false").length) osFail_('SANDBOX_FOREIGN_FILE', 'La carpeta contiene archivos no retirados. Se detuvo la limpieza.');
      try { mdDrive_('drive/v3/files/' + encodeURIComponent(entry.id) + '?fields=id,trashed', { method: 'patch', contentType: 'application/json', payload: JSON.stringify({ trashed: true }) }); }
      catch (ignored) { /* Readback, not another delete or another test. */ }
      if (!osMeta_(entry.id).trashed) osFail_('SANDBOX_CLEANUP_PENDING', 'Falta confirmar la papelera. Retoma la limpieza del mismo ensayo.');
    });
    if (!allowed.every(function(id) { return osMeta_(id).trashed === true; })) osFail_('SANDBOX_CLEANUP_PENDING', 'La limpieza todavía no está confirmada.');
    s.stage = 'CERRADA'; s.closedAt = now_().toISOString(); s.cleanedFiles = allowed.length; delete s.cleanup; osStore_(s);
    return osPublic_(s);
  });
}
