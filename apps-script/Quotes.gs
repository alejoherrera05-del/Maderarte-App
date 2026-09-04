function quoteMeta_(payload, session) {
  requirePermission_(session, 'cotizaciones.read');

  var branch = normalizeCode_(payload && payload.branch);
  if (!branch) throw appError_('QUOTE_BRANCH_REQUIRED', 'Selecciona la sede que emitirá la cotización.', 400);

  var allowedBranches = session && session.profile && Array.isArray(session.profile.branches)
    ? session.profile.branches.map(function(value) { return normalizeCode_(value); })
    : [];
  if (allowedBranches.length && allowedBranches.indexOf(branch) === -1) {
    throw appError_('BRANCH_NOT_ALLOWED', 'Tu cuenta no tiene acceso a esa sede.', 403);
  }

  var row = findRow_('Sedes', 'Sede_ID', branch);
  if (!row || normalizeCode_(row.Estado) !== 'ACTIVA') {
    throw appError_('BRANCH_NOT_AVAILABLE', 'La sede seleccionada no está disponible.', 404);
  }

  var branchFallbacks = {
    MP: {
      name: 'Sede principal',
      address: 'Transversal 9 # 6N-26 · Edificio Dorado · Frente al Éxito Panamericana'
    },
    TP: {
      name: 'Sede norte · Terraplaza',
      address: 'Centro Comercial Terraplaza · Local 113 · Primer piso'
    }
  };
  var fallback = branchFallbacks[branch] || { name: branch, address: '' };
  var nextNumber = Math.max(1, Math.floor(valueNumber_(row.Siguiente_Cotizacion) || 1));
  var prefix = String(row.Prefijo_Cotizacion || 'COT').trim().toUpperCase();
  var previewNumber = prefix + '-' + String(nextNumber).padStart(4, '0');

  return {
    branch: branch,
    branchName: String(row.Nombre || fallback.name),
    branchAddress: String(row.Direccion || fallback.address),
    branchPhone: String(row.Telefono || getConfigValue_('EMPRESA_CELULAR', '3006478590')),
    previewNumber: previewNumber,
    numberStatus: 'PREVISTO',
    issuedAt: now_().toISOString(),
    advisor: String(session && session.profile && session.profile.name || ''),
    company: {
      legalName: getConfigValue_('EMPRESA_RAZON_SOCIAL', 'GRUPO EMPRESARIAL MADERARTE WILLRES SAS'),
      nit: getConfigValue_('EMPRESA_NIT', '901188291-2'),
      mobile: getConfigValue_('EMPRESA_CELULAR', '3006478590'),
      whatsapp: getConfigValue_('EMPRESA_WHATSAPP', '3117476465'),
      website: getConfigValue_('EMPRESA_WEB', 'www.maderartepopayan.com'),
      socialHandle: getConfigValue_('EMPRESA_SOCIALES', '@maderartepopayan')
    }
  };
}

function normalizeQuote_(row) {
  var parsedItems = parseJson_(row.Items_JSON, []);
  return {
    number: String(row.Numero_Cotizacion || ''),
    date: valueDateIso_(row.Fecha),
    branch: normalizeCode_(row.Sede),
    document: String(row.Cedula_NIT || ''),
    client: String(row.Nombre_Cliente || ''),
    phone: String(row.Telefono || ''),
    address: String(row.Direccion || ''),
    description: String(row.Descripcion_Items || ''),
    observations: String(row.Observaciones || ''),
    subtotal: valueNumber_(row.Subtotal),
    discount: valueNumber_(row.Descuento),
    total: valueNumber_(row.Total_Cotizado),
    validityDays: valueNumber_(row.Vigencia_Dias),
    deliveryTime: String(row.Tiempo_Entrega || ''),
    paymentTerms: String(row.Condiciones_Pago || ''),
    status: normalizeCode_(row.Estado || 'ACTIVA'),
    convertedOrder: String(row.Convertida_OP || ''),
    pdfUrl: String(row.URL_PDF_Cotizacion || ''),
    clientFolderUrl: String(row.URL_Carpeta_Cliente || ''),
    monthFolderUrl: String(row.URL_Carpeta_Mes || ''),
    items: Array.isArray(parsedItems) ? parsedItems : [],
    advisor: String(row.Firma_Usuario || row.Creado_Por || ''),
    createdBy: String(row.Creado_Por || ''),
    createdAt: valueDateIso_(row.Fecha_Registro),
    updatedBy: String(row.Actualizado_Por || ''),
    updatedAt: valueDateIso_(row.Actualizado_En)
  };
}

function quoteDateInRange_(value, from, to) {
  if (!from && !to) return true;
  var timestamp = new Date(value || 0).getTime();
  if (!timestamp) return false;
  if (from) {
    var fromTime = new Date(String(from) + 'T00:00:00').getTime();
    if (fromTime && timestamp < fromTime) return false;
  }
  if (to) {
    var toTime = new Date(String(to) + 'T23:59:59').getTime();
    if (toTime && timestamp > toTime) return false;
  }
  return true;
}

function listQuotes_(payload, session) {
  requirePermission_(session, 'cotizaciones.read');
  var query = String(payload && payload.query || '').trim().toLowerCase();
  var branch = normalizeCode_(payload && payload.branch);
  var status = normalizeCode_(payload && payload.status);
  var from = String(payload && payload.from || '').trim();
  var to = String(payload && payload.to || '').trim();
  var limit = Math.min(MADERARTE_APP.MAX_PAGE_SIZE, Math.max(1, Number(payload && payload.limit || 100)));
  var allowedBranches = session && session.profile && Array.isArray(session.profile.branches)
    ? session.profile.branches.map(function(value) { return normalizeCode_(value); }).filter(Boolean)
    : [];

  if (branch && allowedBranches.length && allowedBranches.indexOf(branch) === -1) {
    throw appError_('BRANCH_NOT_ALLOWED', 'Tu cuenta no tiene acceso a esa sede.', 403);
  }

  var items = listRows_('Cotizaciones').map(normalizeQuote_).filter(function(item) {
    if (allowedBranches.length && allowedBranches.indexOf(item.branch) === -1) return false;
    if (branch && item.branch !== branch) return false;
    if (status && item.status !== status) return false;
    if (!quoteDateInRange_(item.date, from, to)) return false;
    if (!query) return true;
    return [item.number, item.document, item.client, item.phone, item.description, item.observations]
      .join(' ')
      .toLowerCase()
      .indexOf(query) !== -1;
  }).sort(function(a, b) {
    return new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime();
  });

  return {
    items: items.slice(0, limit),
    total: items.length,
    amount: items.reduce(function(sum, item) { return sum + valueNumber_(item.total); }, 0),
    limit: limit
  };
}
