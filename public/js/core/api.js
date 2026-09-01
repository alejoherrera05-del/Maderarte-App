import { APP_CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 0, requestId = '', transient = false, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.transient = transient;
    this.details = details;
  }
}

export function createRequestId(prefix = 'WEB') {
  const suffix = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function isTransientStatus(status) {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function apiRequest(action, payload = {}, options = {}) {
  const requestId = options.requestId || createRequestId(action.replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase() || 'WEB');
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, Number(options.timeoutMs || APP_CONFIG.requestTimeoutMs));
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(APP_CONFIG.apiPath, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Maderarte-Request': requestId
      },
      body: JSON.stringify({ action, payload, requestId, appVersion: APP_CONFIG.version }),
      signal: controller.signal
    });

    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok || !body || body.status !== 'success') {
      const message = body?.msg || body?.message || `No fue posible completar la solicitud (${response.status}).`;
      throw new ApiError(message, {
        code: body?.code || `HTTP_${response.status}`,
        status: response.status,
        requestId: body?.requestId || requestId,
        transient: isTransientStatus(response.status),
        details: body?.details || null
      });
    }
    return { ...body, requestId: body.requestId || requestId };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado. Revisa la conexión e inténtalo de nuevo.', {
        code: 'REQUEST_TIMEOUT',
        requestId,
        transient: true
      });
    }
    throw new ApiError('No fue posible conectar con Maderarte App.', {
      code: 'NETWORK_ERROR',
      requestId,
      transient: true,
      details: String(error?.message || error)
    });
  } finally {
    window.clearTimeout(timer);
  }
}
