var PUBLIC_ACTIONS_ = ['PING', 'AUTH_LOGIN', 'INVITACION_VALIDAR', 'INVITACION_ACTIVAR'];

function doGet() {
  return jsonOutput_(success_('APP_SCRIPT_OK', 'Maderarte Apps Script disponible.', { version: MADERARTE_APP.VERSION }, '', 200));
}

function validateProxy_(body) {
  var expected = requiredProperty_('MADERARTE_PROXY_TOKEN');
  if (!secureEquals_(body && body.proxyToken, expected)) throw appError_('PROXY_REJECTED', 'Solicitud no autorizada.', 403);
}

function routeAction_(action, payload, context) {
  switch (action) {
    case 'PING': return { version: MADERARTE_APP.VERSION, name: MADERARTE_APP.NAME };
    case 'AUTH_LOGIN': return login_(payload, context.proxyMeta);
    case 'AUTH_SESSION_VALIDATE': return validateSession_(context.sessionToken);
    case 'AUTH_LOGOUT': return logout_(context.sessionToken);
    case 'INVITACION_VALIDAR': return validateInvitation_(payload);
    case 'INVITACION_ACTIVAR': return activateInvitation_(payload, context.proxyMeta);
    case 'DASHBOARD_RESUMEN': return dashboardSummary_(context.session);
    case 'AGENDA_LISTAR': return agList_(payload, context);
    case 'AGENDA_GUARDAR': return agSave_(payload, context);
    case 'AGENDA_GUARDADO_ESTADO': return agStatus_(payload, context);
    case 'CLIENTES_LISTAR': return listClients_(payload, context.session);
    case 'CLIENTE_OBTENER': return getClient_(payload, context.session);
    case 'COTIZACION_META': return quoteMeta_(payload, context.session);
    case 'COTIZACION_PREPARAR_PEDIDO': return prepareQuoteOrder_(payload, context.session);
    case 'COTIZACIONES_LISTAR': return listQuotes_(payload, context.session);
    case 'COTIZACION_OBTENER': return getQuoteDetail_(payload, context.session);
    case 'COTIZACION_CAPACIDADES': return quoteCreationCapabilities_(context.session);
    case 'COTIZACION_CREAR': return createQuote_(payload, context);
    case 'COTIZACION_CREACION_ESTADO': return quoteCreationStatus_(payload, context);
    case 'COTIZACION_DOCUMENTOS_ESTADO': return qmdStatus_(payload.number, context);
    case 'COTIZACION_FOTO_GUARDAR': return qmdUploadPhoto_(payload, context);
    case 'COTIZACION_FOTO_LEER': return qmdReadPhoto_(payload, context);
    case 'COTIZACION_PDF_LEER': return qmdReadPdf_(payload, context);
    case 'INTERNO_COTIZACION_DOCUMENTO_PREPARAR': return qmdPreparePdf_(payload, context);
    case 'INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR': return qmdConfirmPdf_(payload, context);
    case 'REMISION_CAPACIDADES': return rmCapabilities_(context);
    case 'REMISION_CUENTA': return rmAccount_(payload, context);
    case 'REMISION_CREAR': return rmCreate_(payload, context);
    case 'REMISION_CREACION_ESTADO': return rmStatus_(payload, context);
    case 'REMISION_OBTENER': return rmGet_(payload, context);
    case 'REMISION_PDF_LEER': return rmReadPdf_(payload, context);
    case 'INTERNO_REMISION_DOCUMENTO_PREPARAR': return rmPreparePdf_(payload, context);
    case 'INTERNO_REMISION_DOCUMENTO_CONFIRMAR': return rmConfirmPdf_(payload, context);
    case 'RECIBO_CAPACIDADES': return rcCapabilities_(context);
    case 'RECIBO_CUENTA': return rcAccount_(payload, context);
    case 'RECIBO_CREAR': return rcCreate_(payload, context);
    case 'RECIBO_CREACION_ESTADO': return rcStatus_(payload, context);
    case 'RECIBO_OBTENER': return rcGet_(payload, context);
    case 'RECIBO_PDF_LEER': return rcReadPdf_(payload, context);
    case 'INTERNO_RECIBO_DOCUMENTO_PREPARAR': return rcPreparePdf_(payload, context);
    case 'INTERNO_RECIBO_DOCUMENTO_CONFIRMAR': return rcConfirmPdf_(payload, context);
    case 'PRODUCCION_CUENTA': return ptAccount_(payload, context);
    case 'PRODUCCION_REGISTRAR': return ptRecord_(payload, context);
    case 'PRODUCCION_REGISTRO_ESTADO': return ptStatus_(payload, context);
    case 'ORDENES_LISTAR': return listOrders_(payload, context.session);
    case 'ORDEN_OBTENER': return getOrder_(payload, context.session);
    case 'ORDEN_CREAR': return createOrder_(payload, context);
    case 'ORDEN_CREACION_ESTADO': return orderCreationStatus_(payload, context);
    case 'ORDEN_CAPACIDADES': return orderCreationCapabilities_(context.session);
    case 'SISTEMA_DOCUMENTOS_DIAGNOSTICO': requirePermission_(context.session, 'config.read'); return diagnosticarDocumentosMaddy();
    case 'ORDEN_DOCUMENTOS_ESTADO': return mdPhotoStatus_(payload.number, context);
    case 'ORDEN_FOTO_GUARDAR': return mdUploadPhoto_(payload, context);
    case 'ORDEN_PDF_LEER': return mdReadPdf_(payload, context);
    case 'ORDEN_FOTO_LEER': return mdReadPhoto_(payload, context);
    case 'INTERNO_DOCUMENTO_PREPARAR': return mdPreparePdf_(payload, context);
    case 'INTERNO_DOCUMENTO_CONFIRMAR': return mdConfirmPdf_(payload, context);
    case 'PRUEBA_ESTADO': return osStatus_(context);
    case 'PRUEBA_INICIAR': return osStart_(payload, context);
    case 'PRUEBA_LIMPIAR': return osClean_(payload, context);
    case 'SISTEMA_ESTADO': return systemState_(context.session);
    case 'USUARIOS_LISTAR': return listUsers_(context.session);
    case 'INVITACION_CREAR': return createInvitation_(payload, context.session);
    default: throw appError_('ACTION_NOT_FOUND', 'La acción solicitada no existe.', 404);
  }
}

function doPost(event) {
  var requestId = '';
  try {
    var raw = event && event.postData ? event.postData.contents : '';
    var body = parseJson_(raw, null);
    if (!body || typeof body !== 'object') throw appError_('INVALID_JSON', 'El cuerpo de la solicitud no es válido.', 400);
    requestId = String(body.requestId || '').trim().slice(0, 160);
    var action = normalizeCode_(body.action);
    if (!action) throw appError_('ACTION_REQUIRED', 'Falta la acción solicitada.', 400);
    validateProxy_(body);

    var context = {
      requestId: requestId,
      sessionToken: String(body.sessionToken || ''),
      proxyMeta: body.proxyMeta && typeof body.proxyMeta === 'object' ? body.proxyMeta : {},
      session: null
    };
    if (PUBLIC_ACTIONS_.indexOf(action) === -1) context.session = validateSessionToken_(context.sessionToken, true);
    var run = function() { return routeAction_(action, body.payload && typeof body.payload === 'object' ? body.payload : {}, context); };
    var data = Object.prototype.hasOwnProperty.call(body, 'sandboxId') ? osAdmit_(body.sandboxId, action, context, run) : run();
    return jsonOutput_(success_('OK', 'Operación completada.', data, requestId, 200));
  } catch (error) {
    return jsonOutput_(failure_(error, requestId));
  }
}

