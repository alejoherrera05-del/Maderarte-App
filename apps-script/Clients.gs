function normalizeClient_(row) {
  return {
    document: String(row.Cedula_NIT || ''),
    documentType: String(row.Tipo_Documento || ''),
    name: String(row.Nombre_Completo || ''),
    phone: String(row.Telefono || ''),
    alternatePhone: String(row.Telefono_Alterno || ''),
    email: String(row.Email || ''),
    address: String(row.Direccion || ''),
    city: String(row.Ciudad || ''),
    branch: normalizeCode_(row.Sede_Origen),
    notes: String(row.Notas || ''),
    folderUrl: String(row.URL_Carpeta_Cliente || ''),
    registeredAt: valueDateIso_(row.Fecha_Registro),
    lastPurchaseAt: valueDateIso_(row.Ultima_Compra),
    status: normalizeCode_(row.Estado || 'ACTIVO')
  };
}

function normalizeClientQuote_(row) {
  return {
    number: String(row.Numero_Cotizacion || ''),
    date: valueDateIso_(row.Fecha),
    branch: normalizeCode_(row.Sede),
    description: String(row.Descripcion_Items || ''),
    notes: String(row.Observaciones || ''),
    subtotal: valueNumber_(row.Subtotal),
    discount: valueNumber_(row.Descuento),
    total: valueNumber_(row.Total_Cotizado),
    validityDays: valueNumber_(row.Vigencia_Dias),
    deliveryTime: String(row.Tiempo_Entrega || ''),
    paymentTerms: String(row.Condiciones_Pago || ''),
    status: normalizeCode_(row.Estado || 'BORRADOR'),
    convertedOrder: String(row.Convertida_OP || ''),
    pdfUrl: String(row.URL_PDF_Cotizacion || '')
  };
}

function normalizeClientPayment_(row) {
  return {
    number: String(row.Numero_Recibo || ''),
    orderNumber: String(row.Numero_OP || ''),
    date: valueDateIso_(row.Fecha_Pago),
    value: valueNumber_(row.Valor_Abono),
    method: normalizeCode_(row.Medio_Pago),
    reference: String(row.Referencia || ''),
    comment: String(row.Comentario || ''),
    previousBalance: valueNumber_(row.Saldo_Anterior),
    newBalance: valueNumber_(row.Saldo_Nuevo),
    pdfUrl: String(row.URL_PDF_Recibo || ''),
    supportUrl: String(row.URL_Soporte_Pago || ''),
    status: normalizeCode_(row.Estado_Registro || 'ACTIVO')
  };
}

function clientRelatedOrders_(document) {
  return listRows_('Ordenes_Pedido').filter(function(row) {
    return String(row.Cedula_NIT || '').trim() === document;
  }).map(normalizeOrder_).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

function clientRelatedQuotes_(document) {
  return listRows_('Cotizaciones').filter(function(row) {
    return String(row.Cedula_NIT || '').trim() === document;
  }).map(normalizeClientQuote_).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

function clientRelatedPayments_(document) {
  return listRows_('Abonos').filter(function(row) {
    return String(row.Cedula_NIT || '').trim() === document && normalizeCode_(row.Estado_Registro || 'ACTIVO') !== 'ANULADO';
  }).map(normalizeClientPayment_).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

function clientSummary_(client, orders) {
  var activeOrders = orders.filter(function(order) { return order.status !== 'ANULADA'; });
  return {
    document: client.document,
    documentType: client.documentType,
    name: client.name,
    phone: client.phone,
    email: client.email,
    city: client.city,
    branch: client.branch,
    status: client.status,
    orderCount: orders.length,
    activeOrderCount: activeOrders.length,
    balance: activeOrders.reduce(function(total, order) { return total + valueNumber_(order.balance); }, 0),
    lastPurchaseAt: client.lastPurchaseAt
  };
}

function listClients_(payload, session) {
  requirePermission_(session, 'clientes.read');
  var query = String(payload && payload.query || '').trim().toLowerCase();
  var branch = normalizeCode_(payload && payload.branch);
  var status = normalizeCode_(payload && payload.status);
  var limit = Math.min(MADERARTE_APP.MAX_PAGE_SIZE, Math.max(1, Number(payload && payload.limit || 30)));
  var orderRows = listRows_('Ordenes_Pedido');

  var items = listRows_('Clientes').map(normalizeClient_).filter(function(client) {
    if (branch && client.branch !== branch) return false;
    if (status && client.status !== status) return false;
    if (!query) return true;
    return [client.document, client.documentType, client.name, client.phone, client.alternatePhone, client.email, client.address, client.city]
      .join(' ').toLowerCase().indexOf(query) !== -1;
  }).map(function(client) {
    var orders = orderRows.filter(function(row) { return String(row.Cedula_NIT || '').trim() === client.document; }).map(normalizeOrder_);
    return clientSummary_(client, orders);
  }).sort(function(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });

  return { items: items.slice(0, limit), total: items.length, limit: limit };
}

function getClient_(payload, session) {
  requirePermission_(session, 'clientes.read');
  var document = String(payload && payload.document || '').trim();
  if (!document) throw appError_('CLIENT_DOCUMENT_REQUIRED', 'Falta la identificación del cliente.', 400);

  var row = findRow_('Clientes', 'Cedula_NIT', document);
  if (!row) return null;

  var client = normalizeClient_(row);
  var orders = clientRelatedOrders_(document);
  var quotes = clientRelatedQuotes_(document);
  var payments = clientRelatedPayments_(document);
  var activeOrders = orders.filter(function(order) { return order.status !== 'ANULADA'; });

  return {
    client: client,
    orders: orders,
    quotes: quotes,
    payments: payments,
    summary: {
      orders: orders.length,
      activeOrders: activeOrders.length,
      quotes: quotes.length,
      paid: payments.reduce(function(total, payment) { return total + valueNumber_(payment.value); }, 0),
      balance: activeOrders.reduce(function(total, order) { return total + valueNumber_(order.balance); }, 0)
    }
  };
}
