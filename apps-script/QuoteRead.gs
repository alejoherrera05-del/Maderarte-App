// Full quote readback for the quote dossier. Legacy rows with Items_JSON as an
// array remain readable; new rows freeze supplemental client data with the items.
function quoteStoredPayload_(row) {
  var parsed = parseJson_(row.Items_JSON, []), items = [], client = {};
  if (Array.isArray(parsed)) items = parsed;
  else if (parsed && typeof parsed === 'object') {
    items = Array.isArray(parsed.items) ? parsed.items : [];
    client = parsed.client && typeof parsed.client === 'object' ? parsed.client : {};
  }
  return { items: items, client: client };
}
function getQuote_(payload, session) {
  requirePermission_(session, 'cotizaciones.read');
  var number = String(payload && payload.number || '').trim().toUpperCase();
  if (!number || !QUOTE_NUMBER_RE_.test(number)) throw appError_('QUOTE_NUMBER_INVALID', 'Selecciona una cotización válida.', 400);
  var matches = listRows_('Cotizaciones').filter(function(row) { return String(row.Numero_Cotizacion || '').trim().toUpperCase() === number; });
  if (matches.length > 1) throw appError_('QUOTE_INTEGRITY_ERROR', 'La cotización está duplicada y requiere revisión.', 409);
  if (!matches.length) throw appError_('QUOTE_NOT_FOUND', 'No se encontró la cotización.', 404);
  var row = matches[0], all = session.permissions.indexOf('*') !== -1, branches = session.profile && session.profile.branches || [];
  if (!all && branches.indexOf(normalizeCode_(row.Sede)) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  var stored = quoteStoredPayload_(row);
  var clientRow = listRows_('Clientes').filter(function(client) { return String(client.Cedula_NIT || '').trim() === String(row.Cedula_NIT || '').trim(); })[0] || {};
  return {
    number: String(row.Numero_Cotizacion || ''), date: valueDateIso_(row.Fecha), branch: normalizeCode_(row.Sede), status: normalizeCode_(row.Estado || 'ACTIVA'),
    client: {
      document: String(row.Cedula_NIT || ''), name: String(row.Nombre_Cliente || ''), phone: String(row.Telefono || ''),
      alternatePhone: String(stored.client.alternatePhone || clientRow.Telefono_Alterno || ''),
      email: String(stored.client.email || clientRow.Email || ''), address: String(row.Direccion || ''), city: String(stored.client.city || clientRow.Ciudad || '')
    },
    observations: String(row.Observaciones || ''), subtotal: valueNumber_(row.Subtotal), discount: valueNumber_(row.Descuento), total: valueNumber_(row.Total_Cotizado),
    validityDays: valueNumber_(row.Vigencia_Dias), paymentTerms: String(row.Condiciones_Pago || ''), items: stored.items,
    convertedOrder: String(row.Convertida_OP || ''), pdfUrl: String(row.URL_PDF_Cotizacion || ''), clientFolderUrl: String(row.URL_Carpeta_Cliente || ''),
    monthFolderUrl: String(row.URL_Carpeta_Mes || ''), advisor: String(row.Firma_Usuario || row.Creado_Por || ''), createdAt: valueDateIso_(row.Fecha_Registro),
    documentComplete: Boolean(String(row.URL_PDF_Cotizacion || '').trim())
  };
}
