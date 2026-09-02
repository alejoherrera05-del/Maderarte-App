function normalizeClient_(row) {
  return {
    document: String(row.Cedula_NIT || ''),
    documentType: normalizeCode_(row.Tipo_Documento),
    name: String(row.Nombre_Completo || ''),
    phone: String(row.Telefono || ''),
    alternatePhone: String(row.Telefono_Alterno || ''),
    email: normalizeEmail_(row.Email),
    address: String(row.Direccion || ''),
    city: String(row.Ciudad || ''),
    branch: normalizeCode_(row.Sede_Origen),
    notes: String(row.Notas || ''),
    createdAt: valueDateIso_(row.Fecha_Registro),
    lastPurchase: valueDateIso_(row.Ultima_Compra),
    status: normalizeCode_(row.Estado || 'ACTIVO')
  };
}

function clientOrderSummary_() {
  var summary = {};
  listRows_('Ordenes_Pedido').forEach(function(row) {
    var document = String(row.Cedula_NIT || '').trim();
    if (!document || normalizeCode_(row.Estado) === 'ANULADA') return;
    if (!summary[document]) summary[document] = { orderCount: 0, totalSold: 0, balance: 0 };
    summary[document].orderCount += 1;
    summary[document].totalSold += valueNumber_(row.Valor_Total);
    summary[document].balance += valueNumber_(row.Saldo_Pendiente);
  });
  return summary;
}

function listClients_(payload, session) {
  requirePermission_(session, 'clientes.read');
  var query = String(payload && payload.query || '').trim().toLowerCase();
  var branch = normalizeCode_(payload && payload.branch);
  var status = normalizeCode_(payload && payload.status);
  var limit = Math.min(MADERARTE_APP.MAX_PAGE_SIZE, Math.max(1, Number(payload && payload.limit || 100)));
  var orderSummary = clientOrderSummary_();

  var items = listRows_('Clientes').map(function(row) {
    var client = normalizeClient_(row);
    var commercial = orderSummary[client.document] || { orderCount: 0, totalSold: 0, balance: 0 };
    client.orderCount = commercial.orderCount;
    client.totalSold = commercial.totalSold;
    client.balance = commercial.balance;
    return client;
  }).filter(function(item) {
    if (branch && item.branch !== branch) return false;
    if (status && item.status !== status) return false;
    if (!query) return true;
    return [item.document, item.name, item.phone, item.alternatePhone, item.email, item.city]
      .join(' ')
      .toLowerCase()
      .indexOf(query) !== -1;
  }).sort(function(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
  });

  return { items: items.slice(0, limit), total: items.length, limit: limit };
}

function clientOrders_(document) {
  return listRows_('Ordenes_Pedido').filter(function(row) {
    return String(row.Cedula_NIT || '').trim() === document && normalizeCode_(row.Estado) !== 'ANULADA';
  }).map(normalizeOrder_).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

function clientQuotes_(document) {
  return listRows_('Cotizaciones').filter(function(row) {
    return String(row.Cedula_NIT || '').trim() === document;
  }).map(function(row) {
    return {
      number: String(row.Numero_Cotizacion || ''),
      date: valueDateIso_(row.Fecha),
      branch: normalizeCode_(row.Sede),
      total: valueNumber_(row.Total_Cotizado),
      status: normalizeCode_(row.Estado),
      convertedOrder: String(row.Convertida_OP || '')
    };
  }).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

function clientPayments_(document) {
  return listRows_('Abonos').filter(function(row) {
    return String(row.Cedula_NIT || '').trim() === document && normalizeCode_(row.Estado_Registro || 'ACTIVO') !== 'ANULADO';
  }).map(function(row) {
    return {
      number: String(row.Numero_Recibo || ''),
      orderNumber: String(row.Numero_OP || ''),
      date: valueDateIso_(row.Fecha_Pago),
      value: valueNumber_(row.Valor_Abono),
      method: normalizeCode_(row.Medio_Pago),
      comment: String(row.Comentario || '')
    };
  }).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

function getClient_(payload, session) {
  requirePermission_(session, 'clientes.read');
  var document = String(payload && payload.document || '').trim();
  if (!document) throw appError_('CLIENT_DOCUMENT_REQUIRED', 'Falta la identificación del cliente.', 400);

  var row = findRow_('Clientes', 'Cedula_NIT', document);
  if (!row) return null;

  var client = normalizeClient_(row);
  var orders = clientOrders_(document);
  var quotes = clientQuotes_(document);
  var payments = clientPayments_(document);
  var totalSold = orders.reduce(function(total, item) { return total + valueNumber_(item.total); }, 0);
  var balance = orders.reduce(function(total, item) { return total + valueNumber_(item.balance); }, 0);

  return {
    client: client,
    summary: {
      orderCount: orders.length,
      quoteCount: quotes.length,
      paymentCount: payments.length,
      totalSold: totalSold,
      balance: balance,
      lastPurchase: client.lastPurchase || (orders[0] && orders[0].date) || ''
    },
    orders: orders.slice(0, 50),
    quotes: quotes.slice(0, 50),
    payments: payments.slice(0, 100)
  };
}
