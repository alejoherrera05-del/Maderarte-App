// Conversion uses the existing order transaction, journal and document pipeline.
function conversionSource_(number, session) {
  requirePermission_(session, 'ordenes.create');
  var data = getQuoteDetail_({ number: number }, session);
  orderCreationAllowed_(session, data.branch);
  var related = listRows_('Ordenes_Pedido').filter(function(row) { return String(row.Cotizacion_Origen || '') === number; });
  if (related.length > 1 || related.length === 1 && data.convertedOrder !== related[0].Numero_OP
    || data.convertedOrder && (related.length !== 1 || related[0].Numero_OP !== data.convertedOrder)) {
    throw appError_('QUOTE_CONVERSION_INTEGRITY', 'El vínculo entre cotización y pedido requiere revisión.', 409);
  }
  if (data.convertedOrder) return { convertedOrder: data.convertedOrder, number: number };
  if (!['ACTIVA', 'EMITIDA'].includes(data.status) || !data.documents.complete) {
    throw appError_('QUOTE_NOT_CONVERTIBLE', 'La cotización debe estar activa y tener su PDF y referencias completos.', 409);
  }
  if (!data.clientDetail || !data.items.length) throw appError_('QUOTE_NOT_CONVERTIBLE', 'Faltan los datos originales de la propuesta.', 409);
  var slots = qmdRows_(number);
  var client = {};
  ['document','name','phone','alternatePhone','email','address','city'].forEach(function(key) { client[key] = String(data.clientDetail[key] || ''); });
  var items = data.items.map(function(item, index) {
    var photos = slots.filter(function(slot) { return slot.Tipo === 'FOTO' && slot.Item_ID === item.id; })
      .sort(function(a,b) { return Number(parseJson_(a.Plan_JSON, {}).position) - Number(parseJson_(b.Plan_JSON, {}).position); });
    if (photos.length !== (item.photos || []).length) throw appError_('QUOTE_NOT_CONVERTIBLE', 'Las referencias no coinciden con la cotización.', 409);
    return { clientLineId: String(index + 1), description: item.description, category: item.category || '', quantity: item.quantity,
      unitValue: item.unitValue, fabric: item.fabric || '', wood: item.wood || '', specifications: item.specifications || '',
      photos: photos.map(function(slot) { return { slotId: slot.Archivo_ID, name: parseJson_(slot.Plan_JSON, {}).originalName || slot.Nombre,
        sha256: slot.Hash_SHA256, mime: slot.Mime_Type, size: Number(slot.Bytes) }; }) };
  });
  var source = { branch: data.branch, client: client, items: items, discount: data.discount, notes: data.observations || '' };
  return { number: number, fingerprint: sha256_(JSON.stringify(source)), source: source };
}

function prepareQuoteOrder_(payload, session) {
  orderObject_(payload, ['number'], 'quote');
  var number = quoteText_(payload.number, 'number', 120, true);
  return conversionSource_(number, session); // reads only; never reserves a number
}

function validateQuoteConversion_(draft, session) {
  if (!draft.quoteOrigin) return null;
  var prepared = conversionSource_(draft.quoteOrigin.number, session);
  if (prepared.convertedOrder) throw appError_('QUOTE_ALREADY_CONVERTED', 'Esta cotización ya tiene la OP ' + prepared.convertedOrder + '. Abre el pedido existente.', 409);
  if (prepared.fingerprint !== draft.quoteOrigin.fingerprint) throw appError_('QUOTE_SOURCE_CHANGED', 'La propuesta cambió. Vuelve a abrirla antes de preparar el pedido.', 409);
  var source = prepared.source;
  var stableItem = function(item) { return {
    clientLineId: item.clientLineId, description: item.description, category: item.category, quantity: item.quantity,
    unitValue: item.unitValue, fabric: item.fabric, wood: item.wood, specifications: item.specifications,
    photos: (item.photos || []).map(function(photo) { return { sha256: photo.sha256, mime: photo.mime, size: photo.size }; })
  }; };
  if (draft.branch !== source.branch || draft.discount !== source.discount || JSON.stringify(draft.client) !== JSON.stringify(source.client)
    || JSON.stringify(draft.items.map(stableItem)) !== JSON.stringify(source.items.map(stableItem))) {
    throw appError_('QUOTE_SOURCE_CHANGED', 'Conserva cliente, muebles, referencias y valores de la cotización. Ajusta únicamente acuerdos, disponibilidad, pagos y observaciones.', 409);
  }
  return findRow_('Cotizaciones', 'Numero_Cotizacion', prepared.number);
}

function quoteConversionRequests_(draft, result, session, stamp) {
  if (!draft.quoteOrigin) return [];
  var row = findRow_('Cotizaciones', 'Numero_Cotizacion', draft.quoteOrigin.number);
  return orderUpdateRequests_('Cotizaciones', row._row, { Estado: 'CONVERTIDA', Convertida_OP: result.number,
    Actualizado_Por: session.profile.uid, Actualizado_En: stamp }).concat(orderAppendRequest_('Auditoria', [{
    ID: result.requestId + '-COT-AUD', Fecha: stamp, Usuario: session.profile.uid, Rol: session.profile.role || '',
    Modulo: 'COTIZACIONES', Accion: 'COTIZACION_CONVERTIR', Entidad: 'COTIZACION', Entidad_ID: draft.quoteOrigin.number,
    Resumen: 'Cotización vinculada a ' + result.number, Estado: 'CONFIRMADA', Request_ID: result.requestId,
    Antes_JSON: JSON.stringify({ Estado: row.Estado, Convertida_OP: row.Convertida_OP || '' }),
    Despues_JSON: JSON.stringify({ Estado: 'CONVERTIDA', Convertida_OP: result.number }), Reversible: 'NO',
    Motivo_No_Reversible: 'Conservar cotización y pedido; los cambios requieren movimientos posteriores.'
  }]));
}
