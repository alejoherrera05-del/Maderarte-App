// Quote creation contract v1. Mirrors the order safeguards without sharing data.
var QUOTE_CREATION_CONTRACT_ = 1;

function quoteInputError_(field, message) {
  throw appError_('QUOTE_INPUT_INVALID', message, 400, { field: field });
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

function quoteObject_(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) quoteInputError_(field, 'Revisa los datos de la cotización.');
  Object.keys(value).forEach(function(key) {
    if (allowed.indexOf(key) === -1) quoteInputError_(field + '.' + key, 'La cotización contiene un campo no admitido.');
  });
  return value;
}

function normalizeQuoteCreation_(payload) {
  quoteObject_(payload, ['schemaVersion', 'branch', 'client', 'items', 'discount', 'notes'], 'quote');
  if (payload.schemaVersion !== QUOTE_CREATION_CONTRACT_) throw appError_('QUOTE_CONTRACT_MISMATCH', 'Actualiza la aplicación antes de emitir.', 409);
  var branch = normalizeCode_(payload.branch);
  if (['MP', 'TP'].indexOf(branch) === -1) quoteInputError_('branch', 'Selecciona una sede válida.');

  var rawClient = quoteObject_(payload.client, ['document', 'name', 'phone', 'alternatePhone', 'email', 'address', 'city'], 'client');
  var client = {};
  [['document', 40], ['name', 250], ['phone', 40], ['alternatePhone', 40], ['email', 254], ['address', 500], ['city', 120]].forEach(function(spec) {
    client[spec[0]] = quoteText_(rawClient[spec[0]], 'client.' + spec[0], spec[1], spec[0] !== 'alternatePhone');
  });
  if (!/^[A-Za-z0-9.-]+$/.test(client.document)) quoteInputError_('client.document', 'Revisa la identificación del cliente.');
  if (client.email.toUpperCase() === 'N/A') client.email = 'N/A';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) quoteInputError_('client.email', 'Escribe un correo válido o N/A.');

  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 100) quoteInputError_('items', 'Incluye entre uno y cien muebles.');
  var ids = {};
  var subtotal = 0;
  var items = payload.items.map(function(raw, index) {
    var path = 'items.' + index;
    quoteObject_(raw, ['clientLineId', 'description', 'category', 'quantity', 'unitValue', 'fabric', 'wood', 'specifications', 'photos'], path);
    var clientLineId = quoteText_(raw.clientLineId, path + '.clientLineId', 64, true);
    if (!/^[A-Za-z0-9_-]+$/.test(clientLineId) || ids[clientLineId]) quoteInputError_(path + '.clientLineId', 'El identificador del mueble es inválido o está repetido.');
    ids[clientLineId] = true;
    var quantity = quoteInteger_(raw.quantity, path + '.quantity', 1);
    var unitValue = quoteInteger_(raw.unitValue, path + '.unitValue', 1);
    var lineSubtotal = quoteInteger_(quantity * unitValue, path + '.subtotal', 1);
    subtotal = quoteInteger_(subtotal + lineSubtotal, 'subtotal', 1);
    var item = {
      id: clientLineId,
      clientLineId: clientLineId,
      position: index + 1,
      description: quoteText_(raw.description, path + '.description', 500, true),
      category: quoteText_(raw.category, path + '.category', 80, false),
      quantity: quantity,
      unitValue: unitValue,
      subtotal: lineSubtotal,
      fabric: quoteText_(raw.fabric, path + '.fabric', 500, false),
      wood: quoteText_(raw.wood, path + '.wood', 500, false),
      specifications: quoteText_(raw.specifications, path + '.specifications', 8000, false),
      photos: []
    };
    if (raw.photos !== undefined) {
      if (!(typeof qmdConfigured_ === 'function' && qmdConfigured_())) {
        if (Array.isArray(raw.photos) && raw.photos.length) throw appError_('QUOTE_PHOTOS_NOT_READY', 'El archivo de referencias de cotizaciones todavía no está preparado.', 409, { field: path + '.photos' });
      } else {
        item.photos = mdPhotoManifest_(raw.photos, path + '.photos');
      }
    }
    return item;
  });
  var discount = quoteInteger_(payload.discount, 'discount', 0);
  if (discount > subtotal) quoteInputError_('discount', 'El descuento supera el valor de los muebles.');
  var total = subtotal - discount;
  if (JSON.stringify(items).length > 45000) quoteInputError_('items', 'El detalle es demasiado extenso para guardarse íntegramente.');
  return {
    schemaVersion: QUOTE_CREATION_CONTRACT_,
    branch: branch,
    client: client,
    items: items,
    discount: discount,
    subtotal: subtotal,
    total: total,
    notes: quoteText_(payload.notes, 'notes', 10000, false)
  };
}

function quoteCreationAllowed_(session, branch) {
  requirePermission_(session, 'cotizaciones.create');
  if (!session.profile || !session.profile.uid) throw appError_('NO_SESSION', 'Inicia sesión nuevamente.', 401);
  var branches = Array.isArray(session.profile.branches) ? session.profile.branches : [];
  if (session.permissions.indexOf('*') === -1 && branches.indexOf(branch) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
}

function quoteWritesEnabled_() {
  if (typeof osActive_ === 'function' && osActive_()) return true;
  return MADERARTE_APP.COMMERCIAL_WRITES === true
    && normalizeCode_(getConfigValue_('MODO_OPERACION', '')) === 'OPERACION'
    && optionalProperty_('QUOTE_WRITES_ENABLED', 'NO') === 'SI';
}

function quoteCreationCapabilities_(session) {
  requirePermission_(session, 'cotizaciones.read');
  var canCreate = hasPermission_(session.permissions || [], 'cotizaciones.create');
  var documentsReady = typeof qmdConfigured_ === 'function' && qmdConfigured_();
  return {
    contractVersion: QUOTE_CREATION_CONTRACT_,
    enabled: canCreate && documentsReady && quoteWritesEnabled_(),
    photosReady: documentsReady,
    documentsReady: documentsReady,
    previewWrites: false,
    sandbox: typeof osActive_ === 'function' && osActive_()
  };
}

function quoteRequestId_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,120}$/.test(value)) throw appError_('REQUEST_ID_REQUIRED', 'Falta un identificador de emisión válido.', 400);
  return value;
}

function quoteCreationReplay_(requestId, session, fingerprint) {
  var matches = listRows_('Idempotencia').filter(function(row) { return String(row.Request_ID || '') === requestId; });
  if (matches.length > 1) throw appError_('QUOTE_INTEGRITY_ERROR', 'El registro de emisión requiere revisión.', 409);
  if (!matches.length) return null;
  var row = matches[0];
  if (String(row.Usuario || '') !== session.profile.uid || String(row.Tipo_Operacion || '') !== 'COTIZACION_CREAR') {
    throw appError_('REQUEST_ID_CONFLICT', 'El identificador ya pertenece a otra operación.', 409);
  }
  var saved = parseJson_(row.Resultado_JSON, null);
  if (!saved || row.Estado !== 'CONFIRMADA' || !saved.fingerprint || !saved.result) {
    throw appError_('QUOTE_RECOVERY_REQUIRED', 'Esta emisión requiere revisión; no crees otra cotización.', 409);
  }
  quoteCreationAllowed_(session, saved.result.branch);
  if (fingerprint && saved.fingerprint !== fingerprint) throw appError_('REQUEST_CONTENT_CHANGED', 'La cotización cambió después del intento. Recupera primero el resultado anterior.', 409);
  return saved.result;
}

function quoteNumber_(branchRow) {
  var prefix = String(branchRow.Prefijo_Cotizacion || '').trim().toUpperCase().replace(/-+$/, '');
  var next = branchRow.Siguiente_Cotizacion;
  if (typeof next === 'string' && /^\d+$/.test(next)) next = Number(next);
  if (!Number.isSafeInteger(next) || next < 1 || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(prefix)) {
    throw appError_('NUMBERING_NOT_READY', 'Revisa el prefijo y el consecutivo de cotizaciones de esta sede.', 503);
  }
  var number = prefix + '-' + String(next).padStart(4, '0');
  var used = listRows_('Cotizaciones').some(function(row) { return String(row.Numero_Cotizacion || '') === number; })
    || listRows_('Registro_Numeros').some(function(row) { return String(row.Numero || '') === number; });
  if (used) throw appError_('NUMBER_ALREADY_USED', 'El consecutivo previsto ya aparece registrado. Revisa la numeración antes de continuar.', 409);
  return { number: number, next: next };
}

function quoteClientRequests_(draft, stamp) {
  var existing = findRow_('Clientes', 'Cedula_NIT', draft.client.document);
  var patch = {
    Nombre_Completo: draft.client.name,
    Telefono: draft.client.phone,
    Telefono_Alterno: draft.client.alternatePhone,
    Email: draft.client.email,
    Direccion: draft.client.address,
    Ciudad: draft.client.city,
    Estado: 'ACTIVO'
  };
  if (existing) return orderUpdateRequests_('Clientes', existing._row, patch);
  return [orderAppendRequest_('Clientes', [{
    Cedula_NIT: draft.client.document,
    Tipo_Documento: draft.client.document.indexOf('-') !== -1 ? 'NIT' : 'CC',
    Nombre_Completo: draft.client.name,
    Telefono: draft.client.phone,
    Telefono_Alterno: draft.client.alternatePhone,
    Email: draft.client.email,
    Direccion: draft.client.address,
    Ciudad: draft.client.city,
    Sede_Origen: draft.branch,
    Fecha_Registro: stamp,
    Estado: 'ACTIVO'
  }])];
}

function createQuote_(payload, context) {
  var session = context.session;
  var requestId = quoteRequestId_(context.requestId);
  var draft = normalizeQuoteCreation_(payload);
  quoteCreationAllowed_(session, draft.branch);
  qmdSchema_();
  var fingerprint = sha256_(JSON.stringify(draft));
  var replay = quoteCreationReplay_(requestId, session, fingerprint);
  if (replay) return { saved: true, quote: replay };
  if (!quoteWritesEnabled_()) throw appError_('COMMERCIAL_WRITES_DISABLED', 'La emisión de cotizaciones todavía no está habilitada.', 403);

  var lock = typeof osOperationLock_ === 'function' ? osOperationLock_() : LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('QUOTE_BUSY', 'Hay otra emisión en curso. Consulta el resultado antes de repetir.', 503);
  try {
    replay = quoteCreationReplay_(requestId, session, fingerprint);
    if (replay) return { saved: true, quote: replay };
    var branchRow = findRow_('Sedes', 'Sede_ID', draft.branch);
    if (!branchRow || normalizeCode_(branchRow.Estado) !== 'ACTIVA') throw appError_('BRANCH_NOT_AVAILABLE', 'La sede seleccionada no está disponible.', 409);
    var reserved = quoteNumber_(branchRow);
    var stamp = now_().toISOString();
    var result = {
      number: reserved.number,
      branch: draft.branch,
      requestId: requestId,
      createdAt: stamp,
      documentStatus: 'PENDIENTE'
    };
    var quoteRow = {
      Numero_Cotizacion: result.number,
      Fecha: stamp,
      Sede: draft.branch,
      Cedula_NIT: draft.client.document,
      Nombre_Cliente: draft.client.name,
      Telefono: draft.client.phone,
      Direccion: draft.client.address + (draft.client.city ? ' · ' + draft.client.city : ''),
      Descripcion_Items: draft.items.map(function(item) { return item.description; }).join(' · ').slice(0, 10000),
      Observaciones: draft.notes,
      Subtotal: draft.subtotal,
      Descuento: draft.discount,
      Total_Cotizado: draft.total,
      Estado: 'ACTIVA',
      Items_JSON: JSON.stringify(draft.items),
      Firma_Usuario: session.profile.name || '',
      Creado_Por: session.profile.uid,
      Fecha_Registro: stamp,
      Actualizado_Por: session.profile.uid,
      Actualizado_En: stamp
    };
    var idempotency = {
      Request_ID: requestId,
      Fecha: stamp,
      Tipo_Operacion: 'COTIZACION_CREAR',
      Entidad: 'Cotizaciones',
      Entidad_ID: result.number,
      Estado: 'CONFIRMADA',
      Resultado_JSON: JSON.stringify({ fingerprint: fingerprint, result: result }),
      Expira_En: new Date(new Date(stamp).getTime() + 30 * 86400000).toISOString(),
      Usuario: session.profile.uid,
      Dispositivo_ID: ''
    };
    var numberRegistry = {
      Registro_ID: 'COT-' + sha256_(requestId).slice(0, 28),
      Sede: draft.branch,
      Tipo_Documento: 'COTIZACION',
      Numero: result.number,
      Estado: 'CONFIRMADO',
      Entidad_ID: result.number,
      Reservado_En: stamp,
      Confirmado_En: stamp,
      Usuario: session.profile.uid,
      Request_ID: requestId
    };
    var requests = [];
    requests = requests.concat(quoteClientRequests_(draft, stamp));
    requests.push(orderAppendRequest_('Cotizaciones', [quoteRow]));
    requests.push(orderAppendRequest_('Registro_Numeros', [numberRegistry]));
    requests.push(orderAppendRequest_('Idempotencia', [idempotency]));
    requests = requests.concat(orderUpdateRequests_('Sedes', branchRow._row, { Siguiente_Cotizacion: reserved.next + 1, Actualizado_En: stamp }));
    requests = requests.concat(qmdPlan_(draft, result, session, stamp));
    orderAtomicBatch_(requests);
    var confirmed = findRow_('Cotizaciones', 'Numero_Cotizacion', result.number);
    var replayAfter = quoteCreationReplay_(requestId, session, fingerprint);
    if (!confirmed || !replayAfter || replayAfter.number !== result.number) throw appError_('QUOTE_BATCH_UNCONFIRMED', 'No se pudo confirmar la emisión. Conserva el mismo intento al reintentar.', 503);
    return { saved: true, quote: replayAfter };
  } finally {
    lock.releaseLock();
  }
}

function quoteCreationStatus_(payload, context) {
  var requestId = quoteRequestId_(payload && payload.requestId);
  var replay = quoteCreationReplay_(requestId, context.session, '');
  if (!replay) return { saved: false, requestId: requestId, state: 'NO_CONFIRMADO', retrySameRequest: true };
  return { saved: true, quote: replay };
}
