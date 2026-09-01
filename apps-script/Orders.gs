function normalizeOrder_(row) {
  return {
    number: String(row.Numero_OP || ''),
    date: valueDateIso_(row.Fecha),
    branch: normalizeCode_(row.Sede),
    document: String(row.Cedula_NIT || ''),
    client: String(row.Nombre_Cliente || ''),
    phone: String(row.Telefono || ''),
    address: String(row.Direccion_Entrega || ''),
    description: String(row.Descripcion_Detallada || ''),
    notes: String(row.Observaciones || ''),
    total: valueNumber_(row.Valor_Total),
    paid: valueNumber_(row.Abonado_Total),
    balance: valueNumber_(row.Saldo_Pendiente),
    saleMode: normalizeCode_(row.Modalidad_Venta),
    status: normalizeCode_(row.Estado),
    productionStatus: normalizeCode_(row.Estado_Produccion),
    deliveryDate: valueDateIso_(row.Fecha_Entrega_Estimada),
    owner: String(row.Responsable || ''),
    quoteOrigin: String(row.Cotizacion_Origen || ''),
    pdfUrl: String(row.URL_PDF_OP || ''),
    clientFolderUrl: String(row.URL_Carpeta_Cliente || ''),
    orderFolderUrl: String(row.URL_Carpeta_OP || ''),
    lastPayment: valueNumber_(row.Ultimo_Abono),
    lastPaymentDate: valueDateIso_(row.Fecha_Ultimo_Abono),
    paymentComments: String(row.Comentarios_Abonos || '')
  };
}

function listOrders_(payload, session) {
  requirePermission_(session, 'ordenes.read');
  var query = String(payload && payload.query || '').trim().toLowerCase();
  var branch = normalizeCode_(payload && payload.branch);
  var status = normalizeCode_(payload && payload.status);
  var productionStatus = normalizeCode_(payload && payload.productionStatus);
  var limit = Math.min(MADERARTE_APP.MAX_PAGE_SIZE, Math.max(1, Number(payload && payload.limit || 50)));
  var items = listRows_('Ordenes_Pedido').map(normalizeOrder_).filter(function(item) {
    if (branch && item.branch !== branch) return false;
    if (status && item.status !== status) return false;
    if (productionStatus && item.productionStatus !== productionStatus) return false;
    if (!query) return true;
    return [item.number, item.document, item.client, item.phone, item.description].join(' ').toLowerCase().indexOf(query) !== -1;
  }).sort(function(a, b) {
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
  return { items: items.slice(0, limit), total: items.length, limit: limit };
}

function orderItems_(number) {
  return listRows_('Orden_Items').filter(function(row) { return String(row.Numero_OP || '') === number; }).map(function(row) {
    return {
      id: String(row.Item_ID || ''),
      position: valueNumber_(row.Posicion),
      description: String(row.Descripcion || ''),
      category: String(row.Categoria || ''),
      reference: String(row.Referencia || ''),
      quantity: valueNumber_(row.Cantidad),
      unit: String(row.Unidad || ''),
      unitValue: valueNumber_(row.Valor_Unitario),
      subtotal: valueNumber_(row.Subtotal),
      fabricColor: String(row.Color_Tela || ''),
      woodColor: String(row.Color_Madera || ''),
      measures: String(row.Medidas || ''),
      specifications: String(row.Especificaciones || ''),
      delivered: valueNumber_(row.Cantidad_Entregada),
      pending: valueNumber_(row.Cantidad_Pendiente),
      status: normalizeCode_(row.Estado_Item),
      photoUrl: String(row.URL_Foto || '')
    };
  }).sort(function(a, b) { return a.position - b.position; });
}

function orderPayments_(number) {
  return listRows_('Abonos').filter(function(row) {
    return String(row.Numero_OP || '') === number && normalizeCode_(row.Estado_Registro || 'ACTIVO') !== 'ANULADO';
  }).map(function(row) {
    return {
      number: String(row.Numero_Recibo || ''),
      date: valueDateIso_(row.Fecha_Pago),
      value: valueNumber_(row.Valor_Abono),
      method: normalizeCode_(row.Medio_Pago),
      reference: String(row.Referencia || ''),
      comment: String(row.Comentario || ''),
      previousBalance: valueNumber_(row.Saldo_Anterior),
      newBalance: valueNumber_(row.Saldo_Nuevo),
      pdfUrl: String(row.URL_PDF_Recibo || ''),
      supportUrl: String(row.URL_Soporte_Pago || '')
    };
  }).sort(function(a, b) { return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(); });
}

function orderRemissions_(number) {
  return listRows_('Remisiones').filter(function(row) {
    return String(row.Numero_OP || '') === number && normalizeCode_(row.Estado || 'EMITIDA') !== 'ANULADA';
  }).map(function(row) {
    return {
      number: String(row.Numero_Remision || ''),
      date: valueDateIso_(row.Fecha_Remision),
      receiver: String(row.Persona_Recibe || ''),
      notes: String(row.Observaciones || ''),
      status: normalizeCode_(row.Estado),
      pdfUrl: String(row.URL_PDF_Remision || '')
    };
  });
}

function orderDocuments_(number) {
  return listRows_('Documentos').filter(function(row) {
    return String(row.Numero_Relacionado || '') === number && normalizeCode_(row.Activo || 'SI') !== 'NO';
  }).map(function(row) {
    return {
      id: String(row.ID_Documento || ''),
      type: normalizeCode_(row.Tipo_Documento),
      name: String(row.Nombre_Archivo || ''),
      url: String(row.URL || ''),
      version: valueNumber_(row.Version)
    };
  });
}

function getOrder_(payload, session) {
  requirePermission_(session, 'ordenes.read');
  var number = String(payload && payload.number || '').trim();
  if (!number) throw appError_('ORDER_NUMBER_REQUIRED', 'Falta el número de la orden.', 400);
  var row = findRow_('Ordenes_Pedido', 'Numero_OP', number);
  if (!row) return null;
  return {
    order: normalizeOrder_(row),
    items: orderItems_(number),
    payments: orderPayments_(number),
    remissions: orderRemissions_(number),
    documents: orderDocuments_(number)
  };
}

function dashboardSummary_(session) {
  requirePermission_(session, 'app.access');
  var orders = listRows_('Ordenes_Pedido').map(normalizeOrder_);
  var active = orders.filter(function(item) { return ['CONFIRMADA', 'EN_PROCESO'].indexOf(item.status) !== -1; });
  var priorities = active.filter(function(item) {
    return item.balance > 0 || ['PENDIENTE', 'EN_PROCESO'].indexOf(item.productionStatus) !== -1;
  }).slice(0, 8).map(function(item) {
    return {
      number: item.number,
      client: item.client,
      label: item.balance > 0 ? 'Saldo pendiente' : 'Producción pendiente'
    };
  });
  return {
    metrics: {
      activeOrders: active.length,
      pendingBalance: active.reduce(function(total, item) { return total + item.balance; }, 0),
      pendingProduction: active.filter(function(item) { return ['PENDIENTE', 'EN_PROCESO'].indexOf(item.productionStatus) !== -1; }).length,
      readyDelivery: active.filter(function(item) { return item.productionStatus === 'LISTA'; }).length
    },
    priorities: priorities,
    mode: getConfigValue_('MODO_OPERACION', 'PREPARACION')
  };
}

function systemState_(session) {
  requirePermission_(session, 'config.read');
  verifySchema_();
  return {
    appVersion: MADERARTE_APP.VERSION,
    spreadsheetName: MADERARTE_APP.SPREADSHEET_NAME,
    mode: getConfigValue_('MODO_OPERACION', 'PREPARACION'),
    commercialWrites: MADERARTE_APP.COMMERCIAL_WRITES ? 'HABILITADAS' : 'DESHABILITADAS',
    counts: {
      clients: countRows_('Clientes'),
      orders: countRows_('Ordenes_Pedido'),
      payments: countRows_('Abonos'),
      remissions: countRows_('Remisiones')
    }
  };
}
