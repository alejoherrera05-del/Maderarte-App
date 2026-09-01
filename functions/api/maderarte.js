const COOKIE_NAME = '__Host-maderarte_session';
const MAX_BODY_BYTES = 1_048_576;
const UPSTREAM_TIMEOUT_MS = 20_000;
const PUBLIC_ACTIONS = new Set(['PING', 'AUTH_LOGIN', 'INVITACION_VALIDAR', 'INVITACION_ACTIVAR']);

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers
    }
  });
}

function errorBody(code, msg, requestId = '', details = null) {
  return { status: 'error', code, msg, requestId, ...(details ? { details } : {}) };
}

function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const pair of raw.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(pair.slice(separator + 1).trim()); } catch { return ''; }
  }
  return '';
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
}

function sessionCookie(token, expiresAt, persistent) {
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Strict'];
  if (persistent) {
    const expiryMs = Date.parse(String(expiresAt || ''));
    const maxAge = Number.isFinite(expiryMs) ? Math.max(60, Math.floor((expiryMs - Date.now()) / 1000)) : 2_592_000;
    parts.push(`Max-Age=${maxAge}`);
  }
  return parts.join('; ');
}

function sameOriginAllowed(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== url.origin) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function parseRequestBody(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    const error = new Error('La API solo acepta JSON.');
    error.code = 'UNSUPPORTED_MEDIA_TYPE';
    error.status = 415;
    throw error;
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    const error = new Error('La solicitud supera el tamaño permitido.');
    error.code = 'PAYLOAD_TOO_LARGE';
    error.status = 413;
    throw error;
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    const error = new Error('La solicitud supera el tamaño permitido.');
    error.code = 'PAYLOAD_TOO_LARGE';
    error.status = 413;
    throw error;
  }
  try { return JSON.parse(raw); } catch {
    const error = new Error('El cuerpo JSON no es válido.');
    error.code = 'INVALID_JSON';
    error.status = 400;
    throw error;
  }
}

async function forwardToAppsScript(request, env, body, requestId) {
  const upstreamUrl = String(env.MADERARTE_APPS_SCRIPT_URL || '').trim();
  const proxyToken = String(env.MADERARTE_PROXY_TOKEN || '').trim();
  if (!upstreamUrl || !proxyToken) {
    return jsonResponse(errorBody('API_NOT_CONFIGURED', 'La API todavía no está conectada con Apps Script.', requestId), 503);
  }

  const action = String(body?.action || '').trim().toUpperCase();
  if (!action) return jsonResponse(errorBody('ACTION_REQUIRED', 'Falta la acción solicitada.', requestId), 400);

  const sessionToken = readCookie(request, COOKIE_NAME);
  if (!PUBLIC_ACTIONS.has(action) && !sessionToken) {
    return jsonResponse(errorBody('NO_SESSION', 'Debes iniciar sesión.', requestId), 401, { 'Set-Cookie': clearCookie() });
  }

  const rawIp = request.headers.get('CF-Connecting-IP') || '';
  const ipHash = rawIp ? await sha256(`${proxyToken}:${rawIp}`) : '';
  const payload = {
    action,
    payload: body?.payload && typeof body.payload === 'object' ? body.payload : {},
    requestId,
    appVersion: String(body?.appVersion || ''),
    proxyToken,
    sessionToken,
    proxyMeta: {
      ipHash,
      country: String(request.cf?.country || ''),
      colo: String(request.cf?.colo || '')
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(upstreamUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    const timeout = error?.name === 'AbortError';
    return jsonResponse(errorBody(timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE', timeout ? 'Apps Script tardó demasiado en responder.' : 'No fue posible conectar con Apps Script.', requestId), 503);
  } finally {
    clearTimeout(timer);
  }

  let upstream;
  try { upstream = await response.json(); } catch {
    return jsonResponse(errorBody('INVALID_UPSTREAM_RESPONSE', 'Apps Script devolvió una respuesta no válida.', requestId), 502);
  }

  const requestedStatus = Number(upstream?.httpStatus || 0);
  const status = requestedStatus >= 100 && requestedStatus <= 599
    ? requestedStatus
    : (upstream?.status === 'success' ? 200 : 500);
  const headers = {};
  const sessionFromUpstream = String(upstream?.data?.sessionToken || '');
  if (sessionFromUpstream && ['AUTH_LOGIN', 'INVITACION_ACTIVAR'].includes(action)) {
    headers['Set-Cookie'] = sessionCookie(
      sessionFromUpstream,
      upstream?.data?.expiresAt,
      upstream?.data?.persistent === true
    );
    upstream.data = { ...upstream.data };
    delete upstream.data.sessionToken;
  }
  if (action === 'AUTH_LOGOUT' || ['NO_SESSION', 'SESSION_EXPIRED', 'SESSION_REVOKED'].includes(String(upstream?.code || ''))) {
    headers['Set-Cookie'] = clearCookie();
  }
  delete upstream.httpStatus;
  return jsonResponse({ ...upstream, requestId: upstream?.requestId || requestId }, status, headers);
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const requestId = request.headers.get('X-Maderarte-Request') || crypto.randomUUID();

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
  if (request.method === 'GET') {
    return jsonResponse({ status: 'success', code: 'EDGE_OK', msg: 'Maderarte API disponible.', requestId, data: { version: '0.2.0', path: url.pathname } });
  }
  if (request.method !== 'POST') return jsonResponse(errorBody('METHOD_NOT_ALLOWED', 'Método no permitido.', requestId), 405, { Allow: 'GET, POST, OPTIONS' });
  if (!sameOriginAllowed(request)) return jsonResponse(errorBody('ORIGIN_REJECTED', 'La solicitud no proviene de Maderarte App.', requestId), 403);

  try {
    const body = await parseRequestBody(request);
    return forwardToAppsScript(request, env, body, requestId);
  } catch (error) {
    return jsonResponse(errorBody(error.code || 'BAD_REQUEST', error.message || 'Solicitud no válida.', requestId), error.status || 400);
  }
}

export async function onRequest(context) {
  return handleRequest(context.request, context.env);
}
