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
    case 'CLIENTES_LISTAR': return listClients_(payload, context.session);
    case 'CLIENTE_OBTENER': return getClient_(payload, context.session);
    case 'COTIZACION_META': return quoteMeta_(payload, context.session);
    case 'COTIZACIONES_LISTAR': return listQuotes_(payload, context.session);
    case 'ORDENES_LISTAR': return listOrders_(payload, context.session);
    case 'ORDEN_OBTENER': return getOrder_(payload, context.session);
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
      sessionToken: String(body.sessionToken || ''),
      proxyMeta: body.proxyMeta && typeof body.proxyMeta === 'object' ? body.proxyMeta : {},
      session: null
    };
    if (PUBLIC_ACTIONS_.indexOf(action) === -1) context.session = validateSessionToken_(context.sessionToken, true);
    var data = routeAction_(action, body.payload && typeof body.payload === 'object' ? body.payload : {}, context);
    return jsonOutput_(success_('OK', 'Operación completada.', data, requestId, 200));
  } catch (error) {
    return jsonOutput_(failure_(error, requestId));
  }
}
