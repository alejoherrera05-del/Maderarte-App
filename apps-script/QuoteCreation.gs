// Quote creation contract v1. The browser never assigns a definitive number.
// Deployment alone does not enable writes: production uses the existing global
// gate plus quote-specific switches; the owner sandbox remains isolated.
var QUOTE_CREATION_CONTRACT_ = 1;
var QUOTE_NUMBER_RE_ = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{4,}$/;

function quoteInputError_(field, message) {
  throw appError_('QUOTE_INPUT_INVALID', message, 400, { field: field });
}
function quoteObject_(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) quoteInputError_(field, 'Revisa los datos de la cotización.');
  Object.keys(value).forEach(function(key) {
    if (allowed.indexOf(key) === -1) quoteInputError_(field + '.' + key, 'La cotización contiene un campo no admitido.');
  });
  return value;
}
function quoteText_(value, field, max, required) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') quoteInputError_(field, 'Este dato debe conservarse como texto.');
  var text = value.trim();
  if ((required && !text) || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    quoteInputError_(field, 'Completa o corrige este dato de la cotización.');
  }
  return text;
}
function quoteInteger_(value, field, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) quoteInputError_(field, 'Usa un valor entero válido, sin negativos.');
  return value;
}
function quoteEnum_(value, allowed, field) {
  if (allowed.indexOf(value) === -1) quoteInputError_(field, 'Selecciona una opción válida.');
  return value;
}

function normalizeQuoteCreation_(payload) {
  quoteObject_(payload, ['schemaVersion', 'branch', 'client', 'items', 'discount', 'notes'], 'quote');
  if (payload.schemaVersion !== QUOTE_CREATION_CONTRACT_) throw appError_('QUOTE_CONTRACT_MISMATCH', 'Actualiza la aplicación antes de emitir la cotización.', 409);
  var branch = quoteEnum_(payload.branch, ['MP', 'TP'], 'branch');
  var rawClient = quoteObject_(payload.client, ['document', 'name', 'phone', 'alternatePhone', 'email', 'address', 'city'], 'client');
  var client = {};
  [['document', 40], ['name', 250], ['phone', 40], ['alternatePhone', 40], ['email', 254], ['address', 500], ['city', 120]].forEach(function(spec) {
    client[spec[0]] = quoteText_(rawClient[spec[0]], 'client.' + spec[0], spec[1], spec[0] !== 'alternatePhone');
  });
  if (!/^[A-Za-z0-9.-]+$/.test(client.document)) quoteInputError_('client.document', 'Revisa la identificación del cliente.');
  if (client.email.toUpperCase() === 'N/A') client.email = 'N/A';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) quoteInputError_('client.email', 'Escribe un correo válido o N/A.');
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 100) quoteInputError_('items', 'Incluye entre uno y cien muebles.');
  var seen = new Set(), subtotal = 0;
  var items = payload.items.map(function(raw, index) {
    var path = 'items.' + index;
    quoteObject_(raw, ['clientLineId', 'description', 'category', 'quantity', 'unitValue', 'fabric', 'wood', 'specifications', 'photos'], path);
    if (raw.photos !== undefined && (!Array.isArray(raw.photos) || raw.photos.length) && !(typeof qmConfigured_ === 'function' && qmConfigured_())) {
      throw appError_('QUOTE_PHOTOS_NOT_READY', 'El archivo de fotografías de cotización todavía no está preparado. Conserva el borrador.', 409, { field: path + '.photos' });
    }
    var id = quoteText_(raw.clientLineId, path + '.clientLineId', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || seen.has(id)) quoteInputError_(path + '.clientLineId', 'El identificador del mueble es inválido o está repetido.');
    seen.add(id);
    var quantity = quoteInteger_(raw.quantity, path + '.quantity', 1);
    var unitValue = quoteInteger_(raw.unitValue, path + '.unitValue', 1);
    var gross = quoteInteger_(quantity * unitValue, path + '.subtotal', 1);
    subtotal = quoteInteger_(subtotal + gross, 'subtotal', 1);
    return {
      clientLineId: id, position: index + 1,
      description: quoteText_(raw.description, path + '.description', 500, true),
      category: quoteText_(raw.category, path + '.category', 40, false),
      quantity: quantity, unitValue: unitValue, subtotal: gross,
      fabric: quoteText_(raw.fabric, path + '.fabric', 500, false),
      wood: quoteText_(raw.wood, path + '.wood', 500, false),
      specifications: quoteText_(raw.specifications, path + '.specifications', 8000, false),
      ...(raw.photos && raw.photos.length ? { photos: qmPhotoManifest_(raw.photos, path + '.photos') } : {})
    };
  });
  var discount = quoteInteger_(payload.discount, 'discount', 0);
  if (discount > subtotal) quoteInputError_('discount', 'El descuento supera el valor de los muebles.');
  var total = subtotal - discount;
  if (JSON.stringify(items).length > 40000) quoteInputError_('items', 'El detalle es demasiado extenso para guardar íntegramente.');
  return { schemaVersion: QUOTE_CREATION_CONTRACT_, branch: branch, client: client, items: items,
    discount: discount, notes: quoteText_(payload.notes, 'notes', 10000, false), subtotal: subtotal, total: total };
}

function quoteCreationAllowed_(session, branch) {
  requirePermission_(session, 'cotizaciones.create');
  if (!session.profile || !session.profile.uid) throw appError_('NO_SESSION', 'Inicia sesión nuevamente.', 401);
  var branches = Array.isArray(session.profile.branches) ? session.profile.branches : [];
  if (session.permissions.indexOf('*') === -1 && branches.indexOf(branch) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
}
function quoteRequestId_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,120}$/.test(value)) throw appError_('REQUEST_ID_REQUIRED', 'Falta un identificador de emisión válido.', 400);
  return value;
}
function quoteCreationSchemaReady_() {
  verifySchema_();
  if (typeof qmSchema_ !== 'function') throw appError_('QUOTE_DOCUMENT_SCHEMA_NOT_READY', 'Falta instalar el archivo documental de cotizaciones.', 503);
  qmSchema_();
}
function quoteCreationReplay_(requestId, session, fingerprint) {
  var matches = listRows_('Idempotencia').filter(function(row) { return row.Request_ID === requestId; });
  if (matches.length > 1) throw appError_('QUOTE_INTEGRITY_ERROR', 'El registro de emisión requiere revisión.', 409);
  if (!matches.length) return null;
  var row = matches[0];
  if (row.Usuario !== session.profile.uid || row.Tipo_Operacion !== 'COTIZACION_CREAR') throw appError_('REQUEST_ID_CONFLICT', 'El identificador ya pertenece a otra operación.', 409);
  var saved = parseJson_(row.Resultado_JSON, null);
  if (!saved || row.Estado !== 'CONFIRMADA' || !saved.fingerprint || !saved.result) throw appError_('QUOTE_RECOVERY_REQUIRED', 'Esta emisión requiere revisión; no crees otra cotización.', 409);
  quoteCreationAllowed_(session, saved.result.branch);
  if (fingerprint && saved.fingerprint !== fingerprint) throw appError_('REQUEST_CONTENT_CHANGED', 'La cotización cambió después del intento. Recupera primero el resultado anterior.', 409);
  return saved.result;
}
function quoteNextNumber_(branchRow) {
  var prefix = String(branchRow.Prefijo_Cotizacion || '').trim().toUpperCase().replace(/-+$/, '');
  var next = branchRow.Siguiente_Cotizacion;
  if (typeof next === 'string' && /^\d+$/.test(next)) next = Number(next);
  if (!Number.isSafeInteger(next) || next < 1 || !Number.isSafeInteger(next + 1) || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(prefix)) {
    throw appError_('NUMBERING_NOT_READY', 'Revisa el prefijo y consecutivo de cotizaciones de esta sede.', 503);
  }
  var number = prefix + '-' + String(next).padStart(4, '0');
  if (!QUOTE_NUMBER_RE_.test(number)) throw appError_('NUMBERING_NOT_READY', 'El formato del consecutivo de cotización no es válido.', 503);
  if (listRows_('Registro_Numeros').some(function(row) { return row.Numero === number; })
    || listRows_('Cotizaciones').some(function(row) { return row.Numero_Cotizacion === number; })) {
    throw appError_('NUMBER_ALREADY_USED', 'El consecutivo de cotización ya fue utilizado. Requiere revisión.', 409);
  }
  return number;
}
function quoteValidityDays_() {
  var value = Number(getConfigValue_('COTIZACION_VIGENCIA_DIAS', '15'));
  return Number.isSafeInteger(value) && value > 0 && value <= 365 ? value : 15;
}

function buildQuoteCreationBatch_(draft, requestId, session, branchRow, clientRow, fingerprint) {
  var stamp = now_().toISOString(), number = quoteNextNumber_(branchRow), client = draft.client, user = session.profile.uid;
  var items = draft.items.map(function(item) { return Object.assign({}, item, { id: number + '-I-' + item.clientLineId }); });
  var result = { number: number, branch: draft.branch, requestId: requestId, revision: 1, total: draft.total,
    documentStatus: 'PENDIENTE', items: items.map(function(item) { return { clientLineId: item.clientLineId, id: item.id }; }) };
  var requests = [];
  if (!clientRow) requests.push(orderAppendRequest_('Clientes', [{ Cedula_NIT: client.document, Nombre_Completo: client.name, Telefono: client.phone,
    Telefono_Alterno: client.alternatePhone, Email: client.email, Direccion: client.address, Ciudad: client.city, Sede_Origen: draft.branch,
    Fecha_Registro: stamp, Estado: 'ACTIVO' }]));
  else requests = requests.concat(orderUpdateRequests_('Clientes', clientRow._row, { Nombre_Completo: client.name, Telefono: client.phone,
    Telefono_Alterno: client.alternatePhone, Email: client.email, Direccion: client.address, Ciudad: client.city }));
  var frozen = { version: 1, client: { alternatePhone: client.alternatePhone, email: client.email, city: client.city }, items: items };
  requests.push(orderAppendRequest_('Cotizaciones', [{ Numero_Cotizacion: number, Fecha: stamp, Sede: draft.branch, Cedula_NIT: client.document,
    Nombre_Cliente: client.name, Telefono: client.phone, Direccion: client.address,
    Descripcion_Items: items.map(function(item) { return item.description; }).join(' · '), Observaciones: draft.notes,
    Subtotal: draft.subtotal, Descuento: draft.discount, Total_Cotizado: draft.total, Vigencia_Dias: quoteValidityDays_(),
    Tiempo_Entrega: '', Condiciones_Pago: 'A convenir con el cliente', Estado: 'ACTIVA', Convertida_OP: '',
    Items_JSON: JSON.stringify(frozen), Firma_Usuario: session.profile.name || '', Creado_Por: user, Fecha_Registro: stamp,
    Actualizado_Por: user, Actualizado_En: stamp }]));
  requests.push(orderAppendRequest_('Registro_Numeros', [{ Registro_ID: requestId + '-N0', Sede: draft.branch, Tipo_Documento: 'COTIZACION', Numero: number,
    Estado: 'CONFIRMADO', Entidad_ID: number, Reservado_En: stamp, Confirmado_En: stamp, Usuario: user, Request_ID: requestId }]));
  requests = requests.concat(orderUpdateRequests_('Sedes', branchRow._row, { Siguiente_Cotizacion: Number(branchRow.Siguiente_Cotizacion) + 1, Actualizado_En: stamp }));
  if (typeof qmConfigured_ === 'function' && qmConfigured_()) requests = requests.concat(qmPlan_(draft, items, result, session, stamp));
  requests.push(orderAppendRequest_('Auditoria', [{ ID: requestId + '-AUD', Fecha: stamp, Usuario: user, Rol: session.profile.role || '',
    Modulo: 'COTIZACIONES', Accion: 'COTIZACION_CREAR', Entidad: 'COTIZACION', Entidad_ID: number,
    Resumen: 'Cotización emitida y expediente documental reservado.', Estado: 'CONFIRMADA', Request_ID: requestId,
    Antes_JSON: '{}', Despues_JSON: JSON.stringify(result), Reversible: 'NO', Motivo_No_Reversible: 'La cotización conserva historial; los cambios requieren una nueva versión.' }]));
  requests.push(orderAppendRequest_('Idempotencia', [{ Request_ID: requestId, Fecha: stamp, Tipo_Operacion: 'COTIZACION_CREAR', Entidad: 'COTIZACION', Entidad_ID: number,
    Estado: 'CONFIRMADA', Resultado_JSON: JSON.stringify({ fingerprint: fingerprint, result: result }), Usuario: user,
    Dispositivo_ID: session.sessionRow && session.sessionRow.Dispositivo_ID || '' }]));
  return { requests: requests, result: result };
}

function quoteWriteGateOpen_() {
  return typeof osActive_ === 'function' && osActive_()
    || MADERARTE_APP.COMMERCIAL_WRITES && getConfigValue_('MODO_OPERACION', 'PREPARACION') === 'OPERACION' && optionalProperty_('QUOTE_SAVE_ENABLED', 'NO') === 'SI';
}
function createQuote_(payload, context) {
  if (!quoteWriteGateOpen_()) throw appError_('COMMERCIAL_WRITES_DISABLED', 'La emisión de cotizaciones todavía no está habilitada.', 403);
  var draft = normalizeQuoteCreation_(payload), requestId = quoteRequestId_(context.requestId);
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('QUOTE_SAVE_BUSY', 'Hay otra emisión en curso. Consulta el mismo intento.', 503);
  try {
    if (!quoteWriteGateOpen_()) throw appError_('COMMERCIAL_WRITES_DISABLED', 'La emisión fue deshabilitada. Conserva el borrador.', 403);
    var session = validateSessionToken_(context.sessionToken, false);
    quoteCreationAllowed_(session, draft.branch);
    if (getSpreadsheet_().getName() !== (typeof osDatabaseName_ === 'function' ? osDatabaseName_() : MADERARTE_APP.SPREADSHEET_NAME)) throw appError_('SPREADSHEET_NAME_MISMATCH', 'La base configurada no corresponde a Maderarte.', 503);
    quoteCreationSchemaReady_();
    if (typeof qsValidateDraft_ === 'function') qsValidateDraft_(draft, requestId);
    var fingerprint = sha256_(JSON.stringify(draft));
    var replay = quoteCreationReplay_(requestId, session, fingerprint);
    if (replay) { clearConfirmedQuoteFence_(); return { saved: true, replayed: true, quote: replay }; }
    assertNoUnresolvedQuoteFence_();
    var branches = listRows_('Sedes').filter(function(row) { return row.Sede_ID === draft.branch; });
    if (branches.length !== 1 || branches[0].Estado !== 'ACTIVA') throw appError_('BRANCH_NOT_AVAILABLE', 'La sede no está disponible para emitir.', 403);
    var clients = listRows_('Clientes').filter(function(row) { return String(row.Cedula_NIT).trim() === draft.client.document; });
    if (clients.length > 1) throw appError_('CLIENT_INTEGRITY_ERROR', 'La identificación está duplicada. Revisa el cliente.', 409);
    if (!clients.length) requirePermission_(session, 'clientes.create');
    else if (clients[0].Estado !== 'ACTIVO') throw appError_('CLIENT_INACTIVE', 'El cliente no está activo.', 409);
    var batch = buildQuoteCreationBatch_(draft, requestId, session, branches[0], clients[0], fingerprint);
    SpreadsheetApp.flush();
    if (typeof osReserveQuote_ === 'function') osReserveQuote_(requestId);
    reserveQuoteFence_(requestId, session.profile.uid, fingerprint);
    try { orderAtomicBatch_(batch.requests); }
    catch (error) {
      throw appError_('QUOTE_SAVE_UNCERTAIN', 'No se confirmó la respuesta de emisión. Consulta el mismo intento antes de crear otra cotización.', 503, { requestId: requestId });
    }
    clearConfirmedQuoteFence_();
    return { saved: true, replayed: false, quote: batch.result };
  } finally { lock.releaseLock(); }
}
function quoteCreationStatus_(payload, context) {
  quoteObject_(payload, ['requestId'], 'status');
  var requestId = quoteRequestId_(payload.requestId);
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('QUOTE_SAVE_BUSY', 'La emisión sigue en curso. Consulta de nuevo.', 503);
  try {
    var session = validateSessionToken_(context.sessionToken, false);
    requirePermission_(session, 'cotizaciones.create');
    var result = quoteCreationReplay_(requestId, session, '');
    if (result) { clearConfirmedQuoteFence_(); return { saved: true, quote: result }; }
    var fence = readQuoteFence_();
    return { saved: false, state: fence ? 'REVISION_REQUERIDA' : 'NO_CONFIRMADO', requestId: requestId, retrySameRequest: !fence };
  } finally { lock.releaseLock(); }
}
function quoteCreationCapabilities_(session) {
  requirePermission_(session, 'cotizaciones.read');
  var sandbox = typeof osActive_ === 'function' && osActive_();
  var ready = typeof qmConfigured_ === 'function' && qmConfigured_() && (sandbox || optionalProperty_('QUOTE_DOCUMENTS_ACCEPTED', 'NO') === 'SI');
  if (ready) { try { quoteCreationSchemaReady_(); } catch (error) { ready = false; } }
  var sandboxEmpty = sandbox && countRows_('Cotizaciones') === 0 && countRows_('Ordenes_Pedido') === 0 && !OWNER_SANDBOX_CONTEXT_.quoteRequestId && !OWNER_SANDBOX_CONTEXT_.requestId;
  var enabled = ready && (sandbox ? sandboxEmpty : MADERARTE_APP.COMMERCIAL_WRITES && getConfigValue_('MODO_OPERACION', '') === 'OPERACION'
    && optionalProperty_('QUOTE_SAVE_ENABLED', 'NO') === 'SI' && optionalProperty_('QUOTE_DOCUMENTS_ENABLED', 'NO') === 'SI');
  return { contractVersion: QUOTE_CREATION_CONTRACT_, enabled: Boolean(enabled), reason: enabled ? '' : 'PREPARACION',
    persistenceImplemented: true, photosReady: Boolean(ready), documentsReady: Boolean(ready), mediaWorkflow: 1 };
}
