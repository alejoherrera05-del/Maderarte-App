import { handleRequest as handleApiRequest } from '../functions/api/maderarte.js';

const API_ROOT = '/api/maderarte';

function jsonError(code, message, status = 503) {
  return new Response(JSON.stringify({
    status: 'error',
    code,
    msg: message
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function handleWorkerRequest(request, env = {}) {
  const url = new URL(request.url);

  if (url.pathname === API_ROOT || url.pathname.startsWith(`${API_ROOT}/`)) {
    return handleApiRequest(request, env);
  }

  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return jsonError('ASSETS_NOT_CONFIGURED', 'Los archivos estáticos de Maderarte App todavía no están configurados.');
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleWorkerRequest
};
