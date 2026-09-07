// Order creation contract v1. Routed writes remain behind the existing global
// switch, PREPARACION and an action-specific switch. No work on module load.
var ORDER_CREATION_CONTRACT_ = 1;
var ORDER_CREATION_EXTRA_HEADERS_ = Object.freeze({
  Ordenes_Pedido: ['Subtotal', 'Descuento', 'Telefono_Alterno', 'Email', 'Ciudad', 'Version', 'Estado_Documentos'],
  Orden_Items: ['Acuerdo', 'Disponibilidad', 'Descuento', 'Valor_Neto', 'Cantidad_Desistida', 'Version'],
  Abonos: ['Nota_Interna']
});

function orderInputError_(field, message) {
  throw appError_('ORDER_INPUT_INVALID', message, 400, { field: field });
}

function orderObject_(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) orderInputError_(field, 'Revisa los datos del pedido.');
  Object.keys(value).forEach(function(key) {
    if (allowed.indexOf(key) === -1) orderInputError_(field + '.' + key, 'El pedido contiene un campo no admitido.');
  });
  return value;
}

function orderText_(value, field, max, required) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') orderInputError_(field, 'Este dato debe conservarse como texto.');
  var text = value.trim();
  if ((required && !text) || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    orderInputError_(field, 'Completa o corrige este dato del pedido.');
  }
  return text;
}

function orderInteger_(value, field, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) orderInputError_(field, 'Usa un valor entero válido, sin negativos.');
  return value;
}

function orderEnum_(value, allowed, field) {
  if (allowed.indexOf(value) === -1) orderInputError_(field, 'Selecciona una opción válida.');
  return value;
}

function normalizeOrderCreation_(payload) {
  orderObject_(payload, ['schemaVersion', 'branch', 'client', 'items', 'payments', 'discount', 'notes', 'noPayment'], 'order');
  if (payload.schemaVersion !== ORDER_CREATION_CONTRACT_) throw appError_('ORDER_CONTRACT_MISMATCH', 'Actualiza la aplicación antes de guardar.', 409);
  var branch = orderEnum_(payload.branch, ['MP', 'TP'], 'branch');
  var rawClient = orderObject_(payload.client, ['document', 'name', 'phone', 'alternatePhone', 'email', 'address', 'city'], 'client');
  var client = {};
  [['document', 40], ['name', 250], ['phone', 40], ['alternatePhone', 40], ['email', 254], ['address', 500], ['city', 120]].forEach(function(spec) {
    client[spec[0]] = orderText_(rawClient[spec[0]], 'client.' + spec[0], spec[1], spec[0] !== 'alternatePhone');
  });
  if (!/^[A-Za-z0-9.-]+$/.test(client.document)) orderInputError_('client.document', 'Revisa la identificación del cliente.');
  if (client.email.toUpperCase() === 'N/A') client.email = 'N/A';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) orderInputError_('client.email', 'Escribe un correo válido o N/A.');
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 100) orderInputError_('items', 'Incluye entre uno y cien muebles.');
  var seen = new Set();
  var subtotal = 0;
  var items = payload.items.map(function(raw, index) {
    var path = 'items.' + index;
    orderObject_(raw, ['clientLineId', 'description', 'category', 'quantity', 'unitValue', 'fabric', 'wood', 'specifications', 'agreement', 'fulfillment', 'photos'], path);
    // Never silently discard approved photo references before media storage is ready.
    if (raw.photos !== undefined && (!Array.isArray(raw.photos) || raw.photos.length) && !(typeof mdConfigured_ === 'function' && mdConfigured_())) {
      throw appError_('ORDER_PHOTOS_NOT_READY', 'El guardado de fotografías aún no está habilitado. Conserva el borrador con todas sus referencias.', 409, { field: path + '.photos' });
    }
    var id = orderText_(raw.clientLineId, path + '.clientLineId', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || seen.has(id)) orderInputError_(path + '.clientLineId', 'El identificador del mueble es inválido o está repetido.');
    seen.add(id);
    var quantity = orderInteger_(raw.quantity, path + '.quantity', 1);
    var unitValue = orderInteger_(raw.unitValue, path + '.unitValue', 1);
    var gross = orderInteger_(quantity * unitValue, path + '.subtotal', 1);
    subtotal = orderInteger_(subtotal + gross, 'subtotal', 1);
    var agreement = orderEnum_(raw.agreement, ['ENTREGA_HOY', 'SEPARADO', 'ENTREGA_POSTERIOR'], path + '.agreement');
    var fulfillment = orderEnum_(raw.fulfillment, ['DISPONIBLE', 'PARA_SOLICITAR', 'POR_DEFINIR'], path + '.fulfillment');
    if (agreement === 'ENTREGA_HOY' && fulfillment !== 'DISPONIBLE') orderInputError_(path + '.fulfillment', 'La entrega inmediata requiere disponibilidad.');
    return {
      clientLineId: id, position: index + 1,
      description: orderText_(raw.description, path + '.description', 500, true),
      category: orderText_(raw.category, path + '.category', 40, false),
      quantity: quantity, unitValue: unitValue, subtotal: gross,
      fabric: orderText_(raw.fabric, path + '.fabric', 500, false),
      wood: orderText_(raw.wood, path + '.wood', 500, false),
      specifications: orderText_(raw.specifications, path + '.specifications', 8000, false),
      agreement: agreement, fulfillment: fulfillment,
      ...(raw.photos && raw.photos.length ? { photos: mdPhotoManifest_(raw.photos, path + '.photos') } : {})
    };
  });
  var discount = orderInteger_(payload.discount, 'discount', 0);
  if (discount > subtotal) orderInputError_('discount', 'El descuento supera el valor de los muebles.');
  // Exact largest-remainder allocation; the original net price is frozen per line.
  var parts = items.map(function(item, index) {
    var numerator = BigInt(item.subtotal) * BigInt(discount);
    return { index: index, discount: Number(numerator / BigInt(subtotal)), remainder: numerator % BigInt(subtotal) };
  });
  var remainder = discount - parts.reduce(function(sum, part) { return sum + part.discount; }, 0);
  parts.slice().sort(function(a, b) { return a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1; }).forEach(function(part) { if (remainder-- > 0) part.discount++; });
  items.forEach(function(item, index) { item.discount = parts[index].discount; item.net = item.subtotal - item.discount; });
  if (typeof payload.noPayment !== 'boolean') orderInputError_('noPayment', 'Confirma el pago o la ausencia de abono inicial.');
  if (!Array.isArray(payload.payments) || payload.payments.length > 20) orderInputError_('payments', 'Revisa los medios de pago.');
  var paid = 0;
  var paymentIds = new Set();
  var payments = payload.payments.map(function(raw, index) {
    var path = 'payments.' + index;
    orderObject_(raw, ['clientPaymentId', 'method', 'amount', 'internalNote', 'reference', 'comment'], path);
    var id = orderText_(raw.clientPaymentId, path + '.clientPaymentId', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || paymentIds.has(id)) orderInputError_(path + '.clientPaymentId', 'El pago está repetido o no tiene identificación válida.');
    paymentIds.add(id);
    var amount = orderInteger_(raw.amount, path + '.amount', 1);
    paid = orderInteger_(paid + amount, 'paid', 1);
    return { clientPaymentId: id, method: orderEnum_(raw.method, ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'ADDI'], path + '.method'), amount: amount,
      internalNote: orderText_(raw.internalNote, path + '.internalNote', 2000, false),
      reference: orderText_(raw.reference, path + '.reference', 250, false),
      comment: orderText_(raw.comment, path + '.comment', 1000, false) };
  });
  if (payload.noPayment !== (payments.length === 0)) orderInputError_('payments', 'Confirma los abonos o indica que no hay pago inicial.');
  var total = subtotal - discount;
  if (paid > total) orderInputError_('payments', 'Los pagos superan el total del pedido.');
  if (JSON.stringify(items).length > 40000) orderInputError_('items', 'El detalle es demasiado extenso para guardar íntegramente.');
  return { schemaVersion: ORDER_CREATION_CONTRACT_, branch: branch, client: client, items: items, payments: payments,
    discount: discount, notes: orderText_(payload.notes, 'notes', 10000, false), noPayment: payload.noPayment,
    subtotal: subtotal, total: total, paid: paid, balance: total - paid };
}

function orderCreationAllowed_(session, branch) {
  requirePermission_(session, 'ordenes.create');
  if (!session.profile || !session.profile.uid) throw appError_('NO_SESSION', 'Inicia sesión nuevamente.', 401);
  var branches = Array.isArray(session.profile.branches) ? session.profile.branches : [];
  if (session.permissions.indexOf('*') === -1 && branches.indexOf(branch) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
}

function orderRequestId_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,120}$/.test(value)) throw appError_('REQUEST_ID_REQUIRED', 'Falta un identificador de guardado válido.', 400);
  return value;
}

function orderCreationSchemaReady_() {
  if (optionalProperty_('ORDER_SCHEMA_VERSION', '1') !== '2') throw appError_('ORDER_SCHEMA_NOT_READY', 'La base aún no está preparada para guardar pedidos.', 503);
  verifySchema_();
  Object.keys(ORDER_CREATION_EXTRA_HEADERS_).forEach(function(name) { assertHeaders_(name, ORDER_CREATION_EXTRA_HEADERS_[name]); });
}

function orderCreationReplay_(requestId, session, fingerprint) {
  var matches = listRows_('Idempotencia').filter(function(row) { return row.Request_ID === requestId; });
  if (matches.length > 1) throw appError_('ORDER_INTEGRITY_ERROR', 'El registro del guardado requiere revisión.', 409);
  if (!matches.length) return null;
  var row = matches[0];
  if (row.Usuario !== session.profile.uid || row.Tipo_Operacion !== 'ORDEN_CREAR') throw appError_('REQUEST_ID_CONFLICT', 'El identificador ya pertenece a otra operación.', 409);
  var saved = parseJson_(row.Resultado_JSON, null);
  if (!saved || row.Estado !== 'CONFIRMADA' || !saved.fingerprint || !saved.result) throw appError_('ORDER_RECOVERY_REQUIRED', 'Este guardado requiere revisión; no crees otro pedido.', 409);
  orderCreationAllowed_(session, saved.result.branch);
  if (fingerprint && saved.fingerprint !== fingerprint) throw appError_('REQUEST_CONTENT_CHANGED', 'El pedido cambió después del intento de guardado. Recupera primero el resultado anterior.', 409);
  return saved.result;
}

function orderCell_(value) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw appError_('ORDER_INTEGRITY_ERROR', 'Un importe no es exacto.', 500);
    return { userEnteredValue: { numberValue: value } };
  }
  // stringValue, never formulaValue or USER_ENTERED: IDs keep leading zeros and
  // texts beginning with '=' cannot execute a spreadsheet formula.
  return { userEnteredValue: { stringValue: String(value) } };
}

function orderAppendRequest_(name, objects) {
  var sheet = getSheet_(name);
  var headers = getHeaders_(sheet);
  objects.forEach(function(object) {
    Object.keys(object).forEach(function(key) { if (headers.indexOf(key) === -1) throw appError_('SHEET_SCHEMA_MISMATCH', 'Falta una columna para guardar íntegramente el pedido.', 503); });
  });
  return { appendCells: { sheetId: sheet.getSheetId(), rows: objects.map(function(object) {
    return { values: headers.map(function(header) { return orderCell_(object[header]); }) };
  }), fields: 'userEnteredValue' } };
}

function orderUpdateRequests_(name, row, patch) {
  var sheet = getSheet_(name);
  var headers = getHeaders_(sheet);
  if (!Number.isInteger(row) || row < 2) throw appError_('ORDER_INTEGRITY_ERROR', 'Fila de control inválida.', 500);
  return Object.keys(patch).map(function(key) {
    var column = headers.indexOf(key);
    if (column < 0) throw appError_('SHEET_SCHEMA_MISMATCH', 'Falta una columna de control.', 503);
    return { updateCells: { start: { sheetId: sheet.getSheetId(), rowIndex: row - 1, columnIndex: column }, rows: [{ values: [orderCell_(patch[key])] }], fields: 'userEnteredValue' } };
  });
}

function orderAtomicBatch_(requests) {
  var body = JSON.stringify({ requests: requests, includeSpreadsheetInResponse: false });
  if (body.length > 1500000) throw appError_('ORDER_TOO_LARGE', 'El pedido excede el tamaño de guardado seguro.', 413);
  var response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(requiredProperty_('SPREADSHEET_ID')) + ':batchUpdate', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: body, muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw appError_('ORDER_BATCH_UNCONFIRMED', 'No se pudo confirmar el guardado. Conserva el mismo identificador al reintentar.', 503);
}

function orderNextNumbers_(branchRow, type, count) {
  if (!count) return [];
  var field = type === 'OP' ? 'OP' : 'Recibo';
  var prefix = String(branchRow['Prefijo_' + field] || '').trim().replace(/-+$/, '');
  var next = branchRow['Siguiente_' + field];
  if (typeof next === 'string' && /^\d+$/.test(next)) next = Number(next);
  if (!Number.isSafeInteger(next) || next < 1 || !Number.isSafeInteger(next + count) || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(prefix) || prefix.indexOf(branchRow.Sede_ID + '-') !== 0) {
    throw appError_('NUMBERING_NOT_READY', 'Revisa los prefijos y consecutivos de esta sede.', 503);
  }
  var registered = listRows_('Registro_Numeros');
  var existing = listRows_(type === 'OP' ? 'Ordenes_Pedido' : 'Abonos');
  return Array.from({ length: count }, function(_, index) {
    var number = prefix + '-' + String(next + index).padStart(4, '0');
    if (registered.some(function(row) { return row.Numero === number; }) || existing.some(function(row) { return row[type === 'OP' ? 'Numero_OP' : 'Numero_Recibo'] === number; })) {
      throw appError_('NUMBER_ALREADY_USED', 'El consecutivo ya fue utilizado. Requiere revisión, no se reutilizará.', 409);
    }
    return number;
  });
}

function buildOrderCreationBatch_(draft, requestId, session, branchRow, clientRow, fingerprint) {
  var stamp = now_().toISOString();
  var number = orderNextNumbers_(branchRow, 'OP', 1)[0];
  var receiptNumbers = orderNextNumbers_(branchRow, 'RECIBO', draft.payments.length);
  if (receiptNumbers.indexOf(number) !== -1) throw appError_('NUMBERING_NOT_READY', 'Los prefijos de pedido y recibos deben ser distintos.', 503);
  var client = draft.client;
  var user = session.profile.uid;
  var items = draft.items.map(function(item) { return Object.assign({}, item, { id: number + '-I-' + item.clientLineId }); });
  var result = { number: number, branch: draft.branch, requestId: requestId, revision: 1, total: draft.total, paid: draft.paid, balance: draft.balance,
    documentStatus: 'PENDIENTE', items: items.map(function(item) { return { clientLineId: item.clientLineId, id: item.id }; }),
    receipts: draft.payments.map(function(payment, index) { return { number: receiptNumbers[index], amount: payment.amount, method: payment.method }; }) };
  var requests = [];
  if (!clientRow) requests.push(orderAppendRequest_('Clientes', [{ Cedula_NIT: client.document, Nombre_Completo: client.name, Telefono: client.phone,
    Telefono_Alterno: client.alternatePhone, Email: client.email, Direccion: client.address, Ciudad: client.city, Sede_Origen: draft.branch,
    Fecha_Registro: stamp, Ultima_Compra: stamp, Estado: 'ACTIVO' }]));
  else requests = requests.concat(orderUpdateRequests_('Clientes', clientRow._row, { Ultima_Compra: stamp }));
  requests.push(orderAppendRequest_('Ordenes_Pedido', [{ Fecha: stamp, Numero_OP: number, Sede: draft.branch, Cedula_NIT: client.document, Nombre_Cliente: client.name,
    Telefono: client.phone, Telefono_Alterno: client.alternatePhone, Email: client.email, Ciudad: client.city, Direccion_Entrega: client.address,
    Descripcion_Detallada: items.map(function(item) { return item.description; }).join(' · '), Observaciones: draft.notes,
    Subtotal: draft.subtotal, Descuento: draft.discount, Valor_Total: draft.total, Abonado_Total: draft.paid, Saldo_Pendiente: draft.balance,
    Estado: 'CONFIRMADA', Estado_Produccion: 'PENDIENTE', Responsable: session.profile.name || '', Items_JSON: JSON.stringify(items),
    Ultimo_Abono: draft.payments.length ? draft.payments[draft.payments.length - 1].amount : 0, Fecha_Ultimo_Abono: draft.payments.length ? stamp : '',
    Comentarios_Abonos: draft.payments.map(function(payment) { return payment.comment; }).filter(Boolean).join(' · '),
    Creado_Por: user, Fecha_Registro: stamp, Actualizado_Por: user, Actualizado_En: stamp, Request_ID: requestId, Version: 1, Estado_Documentos: 'PENDIENTE' }]));
  requests.push(orderAppendRequest_('Orden_Items', items.map(function(item) { return {
    Item_ID: item.id, Numero_OP: number, Posicion: item.position, Descripcion: item.description, Categoria: item.category, Cantidad: item.quantity, Unidad: 'UN',
    Valor_Unitario: item.unitValue, Subtotal: item.subtotal, Color_Tela: item.fabric, Color_Madera: item.wood, Especificaciones: item.specifications,
    Cantidad_Entregada: 0, Cantidad_Pendiente: item.quantity, Cantidad_Desistida: 0, Estado_Item: 'PENDIENTE',
    Acuerdo: item.agreement, Disponibilidad: item.fulfillment, Descuento: item.discount, Valor_Neto: item.net, Version: 1, Fecha_Registro: stamp, Actualizado_En: stamp
  }; })));
  var balance = draft.total;
  if (draft.payments.length) requests.push(orderAppendRequest_('Abonos', draft.payments.map(function(payment, index) {
    var previous = balance; balance -= payment.amount;
    return { Numero_Recibo: receiptNumbers[index], Numero_OP: number, Sede: draft.branch, Cedula_NIT: client.document, Nombre_Cliente: client.name,
      Fecha_Pago: stamp, Valor_Abono: payment.amount, Medio_Pago: payment.method, Referencia: payment.reference, Comentario: payment.comment,
      Nota_Interna: payment.internalNote, Saldo_Anterior: previous, Saldo_Nuevo: balance, Registrado_Por: user, Fecha_Registro: stamp,
      Estado_Registro: 'ACTIVO', Afecta_Saldo: 'SI', Request_ID: requestId };
  })));
  requests.push(orderAppendRequest_('Registro_Numeros', [number].concat(receiptNumbers).map(function(value, index) { return {
    Registro_ID: requestId + '-N' + index, Sede: draft.branch, Tipo_Documento: index ? 'RECIBO' : 'OP', Numero: value,
    Estado: 'CONFIRMADO', Entidad_ID: index ? value : number, Reservado_En: stamp, Confirmado_En: stamp, Usuario: user, Request_ID: requestId
  }; })));
  var counters = { Siguiente_OP: Number(branchRow.Siguiente_OP) + 1, Actualizado_En: stamp };
  if (receiptNumbers.length) counters.Siguiente_Recibo = Number(branchRow.Siguiente_Recibo) + receiptNumbers.length;
  requests = requests.concat(orderUpdateRequests_('Sedes', branchRow._row, counters));
  if (typeof mdConfigured_ === 'function' && mdConfigured_()) requests = requests.concat(mdPlan_(draft, items, result, session, stamp));
  requests.push(orderAppendRequest_('Auditoria', [{ ID: requestId + '-AUD', Fecha: stamp, Usuario: user, Rol: session.profile.role || '',
    Modulo: 'ORDENES', Accion: 'ORDEN_CREAR', Entidad: 'ORDEN', Entidad_ID: number, Resumen: 'Pedido y abonos iniciales confirmados.',
    Estado: 'CONFIRMADA', Request_ID: requestId, Antes_JSON: '{}', Despues_JSON: JSON.stringify(result), Reversible: 'NO',
    Motivo_No_Reversible: 'Los cambios requieren movimientos posteriores; nunca borrar la orden.' }]));
  requests.push(orderAppendRequest_('Idempotencia', [{ Request_ID: requestId, Fecha: stamp, Tipo_Operacion: 'ORDEN_CREAR', Entidad: 'ORDEN', Entidad_ID: number,
    Estado: 'CONFIRMADA', Resultado_JSON: JSON.stringify({ fingerprint: fingerprint, result: result }), Usuario: user,
    Dispositivo_ID: session.sessionRow && session.sessionRow.Dispositivo_ID || '' }]));
  return { requests: requests, result: result };
}

function createOrder_(payload, context) {
  // Three closed gates. Deploying this code does NOT enable commercial writes.
  if (!(typeof osActive_ === 'function' && osActive_()) && (!MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', 'PREPARACION') !== 'OPERACION' || optionalProperty_('ORDER_SAVE_ENABLED', 'NO') !== 'SI')) {
    throw appError_('COMMERCIAL_WRITES_DISABLED', 'El guardado comercial todavía no está habilitado.', 403);
  }
  var draft = normalizeOrderCreation_(payload);
  var requestId = orderRequestId_(context.requestId);
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('ORDER_SAVE_BUSY', 'Hay otro guardado en curso. Reintenta con el mismo pedido.', 503);
  try {
    if (!(typeof osActive_ === 'function' && osActive_()) && (!MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', 'PREPARACION') !== 'OPERACION' || optionalProperty_('ORDER_SAVE_ENABLED', 'NO') !== 'SI')) {
      throw appError_('COMMERCIAL_WRITES_DISABLED', 'El guardado fue deshabilitado. Conserva el borrador.', 403);
    }
    // Revalidate AFTER obtaining the lock; never trust the browser or stale context.
    var session = validateSessionToken_(context.sessionToken, false);
    orderCreationAllowed_(session, draft.branch);
    if (draft.payments.length) requirePermission_(session, 'abonos.create');
    if (getSpreadsheet_().getName() !== (typeof osDatabaseName_ === 'function' ? osDatabaseName_() : MADERARTE_APP.SPREADSHEET_NAME)) throw appError_('SPREADSHEET_NAME_MISMATCH', 'La base configurada no corresponde a Maderarte.', 503);
    orderCreationSchemaReady_();
    if (typeof osValidateDraft_ === 'function') osValidateDraft_(draft, requestId);
    var fingerprint = sha256_(JSON.stringify(draft));
    var replay = orderCreationReplay_(requestId, session, fingerprint);
    if (replay) {
      clearConfirmedOrderFence_();
      return { saved: true, replayed: true, order: replay };
    }
    assertNoUnresolvedOrderFence_();
    var branches = listRows_('Sedes').filter(function(row) { return row.Sede_ID === draft.branch; });
    if (branches.length !== 1 || branches[0].Estado !== 'ACTIVA') throw appError_('BRANCH_NOT_AVAILABLE', 'La sede no está disponible para guardar.', 403);
    var clients = listRows_('Clientes').filter(function(row) { return String(row.Cedula_NIT).trim() === draft.client.document; });
    if (clients.length > 1) throw appError_('CLIENT_INTEGRITY_ERROR', 'La identificación está duplicada. Revisa el cliente.', 409);
    if (!clients.length) requirePermission_(session, 'clientes.create');
    else if (clients[0].Estado !== 'ACTIVO') throw appError_('CLIENT_INACTIVE', 'El cliente no está activo.', 409);
    var batch = buildOrderCreationBatch_(draft, requestId, session, branches[0], clients[0], fingerprint);
    // Make SpreadsheetApp's prior auth touches visible before the REST batch.
    SpreadsheetApp.flush();
    // Persist the admission fence BEFORE sending. A timeout may leave Google
    // processing the request after this Apps Script execution releases its lock.
    // A missing result is therefore NOT permission to submit another batch.
    if (typeof osReserveOrder_ === 'function') osReserveOrder_(requestId);
    reserveOrderFence_(requestId, session.profile.uid, fingerprint);
    try { orderAtomicBatch_(batch.requests); }
    catch (error) {
      // The response can be lost AFTER Google committed. Do not reserve a new
      // number, repeat a payment, roll back blindly, or tell the user it failed.
      throw appError_('ORDER_SAVE_UNCERTAIN', 'No se confirmó la respuesta del guardado. Consulta el resultado con el mismo identificador antes de iniciar otro pedido.', 503, { requestId: requestId });
    }
    clearConfirmedOrderFence_();
    return { saved: true, replayed: false, order: batch.result };
  } finally { lock.releaseLock(); }
}

function orderCreationStatus_(payload, context) {
  orderObject_(payload, ['requestId'], 'status');
  var requestId = orderRequestId_(payload.requestId);
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('ORDER_SAVE_BUSY', 'El guardado sigue en curso. Consulta de nuevo.', 503);
  try {
    var session = validateSessionToken_(context.sessionToken, false);
    requirePermission_(session, 'ordenes.create');
    var result = orderCreationReplay_(requestId, session, '');
    if (result) { clearConfirmedOrderFence_(); return { saved: true, order: result }; }
    var fence = readOrderFence_();
    return { saved: false, state: fence ? 'REVISION_REQUERIDA' : 'NO_CONFIRMADO', requestId: requestId, retrySameRequest: !fence };
  } finally { lock.releaseLock(); }
}

function orderCreationCapabilities_(session) {
  requirePermission_(session, 'ordenes.read');
  var sandbox = typeof osActive_ === 'function' && osActive_();
  var ready = typeof mdConfigured_ === 'function' && mdConfigured_()
    && (sandbox || optionalProperty_('ORDER_DOCUMENTS_ACCEPTED', 'NO') === 'SI');
  if (ready) { try { orderCreationSchemaReady_(); mdSchema_(); } catch (error) { ready = false; } }
  var enabled = ready && (sandbox ? !OWNER_SANDBOX_CONTEXT_.requestId && countRows_('Ordenes_Pedido') === 0 : MADERARTE_APP.COMMERCIAL_WRITES && getConfigValue_('MODO_OPERACION', '') === 'OPERACION'
    && optionalProperty_('ORDER_SAVE_ENABLED', 'NO') === 'SI' && optionalProperty_('ORDER_DOCUMENTS_ENABLED', 'NO') === 'SI');
  return { contractVersion: ORDER_CREATION_CONTRACT_, enabled: Boolean(enabled), reason: enabled ? '' : 'PREPARACION',
    persistenceImplemented: true, photosReady: Boolean(ready), documentsReady: Boolean(ready), mediaWorkflow: 1 };
}

// Owner-run installation step, not routed from the browser. Only extends empty
// commercial schemas; never imports or alters commercial records or permissions.
function prepararEsquemaGuardadoOrdenes() {
  if (MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', 'PREPARACION') !== 'PREPARACION') {
    throw appError_('SCHEMA_SETUP_NOT_ALLOWED', 'Prepara el esquema solo con la operación comercial deshabilitada.', 403);
  }
  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('ORDER_SAVE_BUSY', 'Hay otra operación en curso.', 503);
  try {
    if (getSpreadsheet_().getName() !== (typeof osDatabaseName_ === 'function' ? osDatabaseName_() : MADERARTE_APP.SPREADSHEET_NAME)) throw appError_('SPREADSHEET_NAME_MISMATCH', 'Base incorrecta.', 503);
    verifyCommercialBaseZero_();
    var requests = [];
    Object.keys(REQUIRED_HEADERS).forEach(function(name) {
      var sheet = getSheet_(name);
      var actual = getHeaders_(sheet);
      var base = REQUIRED_HEADERS[name];
      var extra = ORDER_CREATION_EXTRA_HEADERS_[name] || [];
      var expanded = base.concat(extra);
      var matches = function(expected) { return actual.length === expected.length && actual.every(function(header, index) { return header === expected[index]; }); };
      if (matches(expanded)) return;
      if (!matches(base)) throw appError_('SHEET_SCHEMA_MISMATCH', 'El esquema requiere revisión antes de ampliarlo.', 503, { sheet: name });
      if (sheet.getMaxColumns() < expanded.length) requests.push({ appendDimension: { sheetId: sheet.getSheetId(), dimension: 'COLUMNS', length: expanded.length - sheet.getMaxColumns() } });
      requests.push({ updateCells: { start: { sheetId: sheet.getSheetId(), rowIndex: 0, columnIndex: base.length }, rows: [{ values: extra.map(orderCell_) }], fields: 'userEnteredValue' } });
    });
    if (requests.length) { SpreadsheetApp.flush(); orderAtomicBatch_(requests); }
    // If the response above was lost, rerunning detects already extended headers.
    getScriptProperties_().setProperty('ORDER_SCHEMA_VERSION', '2');
    return { schemaVersion: 2, commercialWrites: false, requiresDeploymentVerification: true };
  } finally { lock.releaseLock(); }
}
