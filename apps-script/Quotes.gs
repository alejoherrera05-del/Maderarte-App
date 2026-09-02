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

  var nextNumber = Math.max(1, Math.floor(valueNumber_(row.Siguiente_Cotizacion) || 1));
  var prefix = String(row.Prefijo_Cotizacion || 'COT').trim().toUpperCase();
  var previewNumber = prefix + '-' + String(nextNumber).padStart(4, '0');

  return {
    branch: branch,
    branchName: String(row.Nombre || branch),
    branchAddress: String(row.Direccion || ''),
    branchPhone: String(row.Telefono || ''),
    previewNumber: previewNumber,
    numberStatus: 'PREVISTO',
    issuedAt: now_().toISOString(),
    advisor: String(session && session.profile && session.profile.name || ''),
    company: {
      legalName: getConfigValue_('EMPRESA_RAZON_SOCIAL', 'MADERARTE POPAYÁN S.A.S.'),
      nit: getConfigValue_('EMPRESA_NIT', ''),
      website: getConfigValue_('EMPRESA_WEB', 'maderartepopayan.com')
    }
  };
}
