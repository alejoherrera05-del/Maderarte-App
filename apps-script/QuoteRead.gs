function quoteDocumentSnapshot_(number) {
  if (!(typeof qmdConfigured_ === 'function' && qmdConfigured_())) return { number: number, complete: false, files: [] };
  var files = qmdRows_(number);
  return {
    number: number,
    complete: files.some(function(row) { return row.Tipo === 'COTIZACION'; }) && files.every(function(row) { return row.Estado === 'LISTO' && row.URL; }),
    files: files.map(function(row) {
      var plan = row.Tipo === 'FOTO' ? parseJson_(row.Plan_JSON, {}) : {};
      return {
        id: row.Archivo_ID,
        itemId: row.Item_ID || '',
        photoId: row.Foto_ID || '',
        type: row.Tipo,
        name: plan.originalName || row.Nombre,
        position: plan.position || 0,
        mime: row.Mime_Type,
        ready: row.Estado === 'LISTO',
        url: row.Estado === 'LISTO' ? row.URL : ''
      };
    })
  };
}

function getQuoteDetail_(payload, session) {
  requirePermission_(session, 'cotizaciones.read');
  var number = String(payload && payload.number || '').trim();
  if (!number) throw appError_('QUOTE_NUMBER_REQUIRED', 'Falta el número de cotización.', 400);
  var rows = listRows_('Cotizaciones').filter(function(row) { return String(row.Numero_Cotizacion || '').trim() === number; });
  if (rows.length > 1) throw appError_('QUOTE_INTEGRITY_ERROR', 'La cotización aparece repetida y requiere revisión.', 409);
  if (!rows.length) throw appError_('QUOTE_NOT_FOUND', 'No se encontró la cotización.', 404);
  var row = rows[0];
  var all = session.permissions.indexOf('*') !== -1;
  var branches = session.profile && session.profile.branches || [];
  if (!all && branches.indexOf(normalizeCode_(row.Sede)) === -1) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  var result = normalizeQuote_(row);
  var clientRow = findRow_('Clientes', 'Cedula_NIT', row.Cedula_NIT);
  result.clientDetail = clientRow ? normalizeClient_(clientRow) : null;
  if (typeof qmdConfigured_ === 'function' && qmdConfigured_()) {
    var pdf = mdUnique_(qmdRows_(number), 'Tipo', 'COTIZACION');
    var plan = pdf && parseJson_(pdf.Plan_JSON, null);
    if (plan && plan.number === number && plan.client) result.clientDetail = plan.client;
  }
  result.documents = quoteDocumentSnapshot_(number);
  return result;
}
