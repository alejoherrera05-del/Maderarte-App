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
