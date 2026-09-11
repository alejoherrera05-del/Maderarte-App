// Administrative editor functions. Never expose these through Router/doPost.
function commercialLaunchCheck_() {
  if (typeof osActive_ === 'function' && osActive_()) throw appError_('LAUNCH_CONTEXT_INVALID', 'La activación requiere la base oficial.', 409);
  if (getSpreadsheet_().getName() !== MADERARTE_APP.SPREADSHEET_NAME) throw appError_('LAUNCH_BASE_INVALID', 'Revisa la base oficial.', 409);
  verifySchema_(); verifyInitialRoles_(); verifyInitialBranches_(); verifyOwner_();
  orderCreationSchemaReady_(); mdSchema_(); qmdSchema_();
  if (readOrderFence_()) throw appError_('LAUNCH_PENDING_TRANSACTION', 'Existe una operación pendiente. Resuelve su resultado antes de activar.', 409);
  var root = mdMeta_(requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID'));
  if (root.trashed || root.mimeType !== 'application/vnd.google-apps.folder' || root.name !== '02_DOCUMENTOS_CLIENTES') throw appError_('LAUNCH_DRIVE_INVALID', 'Revisa la carpeta documental oficial.', 409);
  var modes = listRows_('Configuracion').filter(function(r) { return r.Clave === 'MODO_OPERACION'; });
  if (modes.length !== 1 || ['PREPARACION', 'OPERACION'].indexOf(modes[0].Valor) === -1) throw appError_('LAUNCH_MODE_INVALID', 'Revisa el modo de operación.', 409);
  var seen = {};
  listRows_('Registro_Numeros').forEach(function(r) {
    if (!r.Numero || seen[r.Numero]) throw appError_('LAUNCH_NUMBER_DUPLICATE', 'Hay numeración que requiere revisión.', 409);
    seen[r.Numero] = true;
  });
  ['Archivos_Orden', 'Archivos_Cotizacion'].forEach(function(sheet) {
    if (listRows_(sheet).some(function(r) { return r.Estado !== 'LISTO'; })) throw appError_('LAUNCH_DOCUMENTS_PENDING', 'Hay documentos pendientes de finalizar.', 409);
  });
  listRows_('Ordenes_Pedido').forEach(function(r) {
    rcPosition_(r);
    if (r.Estado_Documentos !== 'COMPLETO' || !r.URL_PDF_OP) throw appError_('LAUNCH_DOCUMENTS_PENDING', 'Una orden requiere finalizar sus documentos.', 409);
  });
  var next = ['MP', 'TP'].map(function(id) {
    var rows = listRows_('Sedes').filter(function(r) { return r.Sede_ID === id; });
    if (rows.length !== 1) throw appError_('LAUNCH_BRANCH_INVALID', 'Hay sedes repetidas.', 409);
    var r = rows[0], value = Number(r.Siguiente_Remision), prefix = String(r.Prefijo_Remision || '');
    if (!Number.isSafeInteger(value) || value < 1 || !new RegExp('^' + id + '-[A-Z0-9-]+$').test(prefix)) throw appError_('NUMBERING_NOT_READY', 'Revisa el consecutivo de remisiones.', 409);
    var remission = prefix + '-' + String(value).padStart(4, '0');
    if (seen[remission] || listRows_('Remisiones').some(function(x) { return x.Numero_Remision === remission; })) throw appError_('NUMBER_ALREADY_USED', 'El consecutivo de remisión ya existe.', 409);
    return { branch: id, quote: quoteNumber_(r).number, order: orderNextNumbers_(r, 'OP', 1)[0], receipt: orderNextNumbers_(r, 'RECIBO', 1)[0], remission: remission };
  });
  var allNext = next.reduce(function(a, r) { return a.concat([r.quote, r.order, r.receipt, r.remission]); }, []);
  if (new Set(allNext).size !== allNext.length) throw appError_('NUMBERING_NOT_READY', 'Los tipos de documento comparten un consecutivo.', 409);
  return { ok: true, version: 1, enabled: commercialWritesEnabled_(), mode: modes[0].Valor, next: next };
}

function commercialLaunchLocked_(run) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('LAUNCH_BUSY', 'Hay una operación en curso. Reintenta la comprobación.', 503);
  try { return run(); } finally { lock.releaseLock(); }
}

function diagnosticarOperacionComercial() {
  return commercialLaunchLocked_(function() { var result = commercialLaunchCheck_(); Logger.log(JSON.stringify(result)); return result; });
}

function activarOperacionComercial() {
  return commercialLaunchLocked_(function() {
    commercialLaunchCheck_();
    var props = getScriptProperties_();
    // Fail closed if any subsequent administrative write fails.
    props.setProperty('COMMERCIAL_OPERATION_ENABLED', 'NO');
    var mode = findRow_('Configuracion', 'Clave', 'MODO_OPERACION');
    orderAtomicBatch_(orderUpdateRequests_('Configuracion', mode._row, { Valor: 'OPERACION' }).concat([orderAppendRequest_('Auditoria', [{ ID: Utilities.getUuid(), Fecha: now_().toISOString(), Usuario: 'EDITOR_APPS_SCRIPT', Modulo: 'CONFIGURACION', Accion: 'ACTIVACION_COMERCIAL_PREPARADA', Entidad: 'Configuracion', Entidad_ID: 'MODO_OPERACION', Estado: 'CONFIRMADA', Resumen: 'Configuración preparada; requiere confirmación de la compuerta privada.', Antes_JSON: JSON.stringify({ mode: mode.Valor }), Despues_JSON: JSON.stringify({ mode: 'OPERACION' }) }])]));
    if (getConfigValue_('MODO_OPERACION', '') !== 'OPERACION') throw appError_('LAUNCH_UNCONFIRMED', 'No se confirmó el modo. Las ventas siguen cerradas.', 503);
    ['ORDER_SAVE_ENABLED', 'ORDER_DOCUMENTS_ENABLED', 'ORDER_DOCUMENTS_ACCEPTED', 'RECEIPT_SAVE_ENABLED', 'REMISSION_SAVE_ENABLED', 'PRODUCTION_SAVE_ENABLED', 'QUOTE_WRITES_ENABLED', 'QUOTE_DOCUMENTS_ENABLED', 'QUOTE_OPERATION_ACCEPTED'].forEach(function(key) {
      props.setProperty(key, 'SI');
      if (props.getProperty(key) !== 'SI') throw appError_('LAUNCH_UNCONFIRMED', 'No se confirmó la configuración. Las ventas siguen cerradas.', 503);
    });
    props.setProperty('COMMERCIAL_OPERATION_ENABLED', 'SI');
    var result;
    try {
      result = commercialLaunchCheck_();
      if (!result.enabled) throw appError_('LAUNCH_UNCONFIRMED', 'No se confirmó la activación.', 503);
    } catch (error) { props.setProperty('COMMERCIAL_OPERATION_ENABLED', 'NO'); throw error; }
    Logger.log(JSON.stringify(result)); return result;
  });
}

function pausarOperacionComercial() {
  return commercialLaunchLocked_(function() {
    getScriptProperties_().setProperty('COMMERCIAL_OPERATION_ENABLED', 'NO');
    if (commercialWritesEnabled_()) throw appError_('LAUNCH_UNCONFIRMED', 'No se confirmó la pausa.', 503);
    var result = { ok: true, enabled: false, quotationsEnabled: quoteWritesEnabled_() };
    Logger.log(JSON.stringify(result)); return result;
  });
}

