import { APP_CONFIG, withPreview } from './config.js';
import { apiRequest, ApiError } from './api.js';
import { clearSessionSnapshot, getDeviceMetadata, readSessionSnapshot, writeSessionSnapshot } from './session.js';

const FIREBASE_BASE = 'https://identitytoolkit.googleapis.com/v1';
export const SESSION_REVALIDATE_AFTER_MS = 5 * 60 * 1000;

async function firebaseRequest(endpoint, payload) {
  const response = await fetch(`${FIREBASE_BASE}/${endpoint}?key=${encodeURIComponent(APP_CONFIG.firebase.apiKey)}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(body?.error?.message || 'FIREBASE_ERROR');
    const messages = {
      EMAIL_NOT_FOUND: 'No existe una cuenta con ese correo.',
      INVALID_PASSWORD: 'La contraseña no es correcta.',
      INVALID_LOGIN_CREDENTIALS: 'El correo o la contraseña no son correctos.',
      USER_DISABLED: 'Esta cuenta está deshabilitada.',
      EMAIL_EXISTS: 'La cuenta ya existe. Ingresa con tu cuenta autorizada de Maderarte.',
      WEAK_PASSWORD: 'La contraseña debe tener al menos seis caracteres.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Se bloquearon temporalmente los intentos. Inténtalo más tarde.'
    };
    throw new ApiError(messages[code] || 'No fue posible validar la cuenta.', { code, status: response.status });
  }
  return body;
}

export async function signIn(email, password, remember = false) {
  if (APP_CONFIG.preview.enabled) return createPreviewSession(remember ? 'local' : 'session');
  const firebase = await firebaseRequest('accounts:signInWithPassword', {
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    returnSecureToken: true
  });
  const response = await apiRequest('AUTH_LOGIN', {
    firebaseIdToken: firebase.idToken,
    device: getDeviceMetadata(),
    persistent: Boolean(remember)
  });
  return writeSessionSnapshot(response.data, remember ? 'local' : 'session');
}

export async function createFirebaseAccount(email, password) {
  return firebaseRequest('accounts:signUp', {
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    returnSecureToken: true
  });
}

export async function signInFirebaseOnly(email, password) {
  return firebaseRequest('accounts:signInWithPassword', {
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    returnSecureToken: true
  });
}

export async function sendPasswordReset(email) {
  if (APP_CONFIG.preview.enabled) return { preview: true };
  return firebaseRequest('accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email: String(email || '').trim().toLowerCase()
  });
}

async function validateSessionRemote({ allowCachedOnTransient = true } = {}) {
  try {
    const response = await apiRequest('AUTH_SESSION_VALIDATE', { device: getDeviceMetadata() });
    const cached = readSessionSnapshot();
    return writeSessionSnapshot(response.data, cached?.persistence || 'session');
  } catch (error) {
    const cached = readSessionSnapshot();
    if (allowCachedOnTransient && error?.transient && cached) return { ...cached, offline: true };
    if (!error?.transient) clearSessionSnapshot();
    throw error;
  }
}

export async function validateSession({ allowCachedOnTransient = true, preferCache = false } = {}) {
  if (APP_CONFIG.preview.enabled) return createPreviewSession('session');
  const cached = readSessionSnapshot();
  if (preferCache && cached) {
    return {
      ...cached,
      cacheFirst: true,
      needsRevalidation: Date.now() - Number(cached.validatedAt || 0) >= SESSION_REVALIDATE_AFTER_MS
    };
  }
  return validateSessionRemote({ allowCachedOnTransient });
}

export async function revalidateSession({ allowCachedOnTransient = true } = {}) {
  if (APP_CONFIG.preview.enabled) return createPreviewSession('session');
  return validateSessionRemote({ allowCachedOnTransient });
}

export async function logout() {
  try {
    if (!APP_CONFIG.preview.enabled) await apiRequest('AUTH_LOGOUT', { device: getDeviceMetadata() }, { timeoutMs: 8_000 });
  } catch {
    // La limpieza local debe ejecutarse incluso si la red falla.
  } finally {
    clearSessionSnapshot();
  }
}

export async function activateInvitation(token, firebaseIdToken, persistence = 'session') {
  const response = await apiRequest('INVITACION_ACTIVAR', {
    token: String(token || '').trim(),
    firebaseIdToken,
    device: getDeviceMetadata(),
    persistent: persistence === 'local'
  });
  return writeSessionSnapshot(response.data, persistence);
}

export async function validateInvitation(token) {
  const response = await apiRequest('INVITACION_VALIDAR', { token: String(token || '').trim() });
  return response.data;
}

export function loginRedirect(next = window.location.pathname + window.location.search) {
  const url = new URL(APP_CONFIG.loginPath, window.location.origin);
  const safeNext = String(next || '').startsWith('/') ? String(next) : APP_CONFIG.homePath;
  url.searchParams.set('next', safeNext);
  if (APP_CONFIG.preview.enabled) url.searchParams.set('preview', '1');
  return `${url.pathname}${url.search}`;
}

export function createPreviewSession(persistence = 'session') {
  const session = {
    profile: {
      uid: 'preview-local',
      email: 'vista@local.test',
      name: 'Vista local',
      role: 'PROPIETARIO',
      status: 'ACTIVO',
      mainBranch: 'MP',
      branches: ['MP', 'TP']
    },
    permissions: ['*'],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
  return writeSessionSnapshot(session, persistence);
}

export function previewApiData(action) {
  if (!APP_CONFIG.preview.enabled) return null;
  const common = { status: 'success', code: 'PREVIEW_LOCAL', msg: 'Vista local sin datos comerciales.', requestId: 'PREVIEW-LOCAL' };
  if (action === 'DASHBOARD_RESUMEN') return { ...common, data: { metrics: { activeOrders: 0, pendingBalance: 0, pendingProduction: 0, readyDelivery: 0 }, priorities: [], mode: 'PREPARACION' } };
  if (action === 'CLIENTES_LISTAR') return { ...common, data: { items: [], total: 0 } };
  if (action === 'CLIENTE_OBTENER') return { ...common, data: null };
  if (action === 'ORDENES_LISTAR') return { ...common, data: { items: [], total: 0 } };
  if (action === 'ORDEN_OBTENER') return { ...common, data: null };
  if (action === 'SISTEMA_ESTADO') return { ...common, data: { appVersion: APP_CONFIG.version, mode: 'PREPARACION', commercialWrites: 'DESHABILITADAS', sheets: [], counts: { clients: 0, orders: 0, payments: 0, remissions: 0 } } };
  if (action === 'USUARIOS_LISTAR') return { ...common, data: { items: [], total: 0 } };
  return { ...common, data: {} };
}

export function homeUrl() {
  return withPreview(APP_CONFIG.homePath);
}
