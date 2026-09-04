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
  if (action === 'COTIZACIONES_LISTAR') {
    const ago = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      { number: 'MP-0251', date: ago(2), branch: 'MP', document: '1061760852', client: 'María Fernanda López', phone: '3125559081', description: 'Sofá Oslo, poltronas Nova y mesa Mandala', observations: 'Cliente revisando tonos finales de tela antes de confirmar.', subtotal: 7300000, discount: 300000, total: 7000000, validityDays: 15, deliveryTime: '25–30 días', paymentTerms: '', status: 'ACTIVA', convertedOrder: '', pdfUrl: '', advisor: 'Alejandro Herrera' },
      { number: 'TP-0128', date: ago(6), branch: 'TP', document: '1029456721', client: 'Carolina Ruiz', phone: '3154408921', description: 'Sala Canoa y mesa de centro', observations: 'Solicitó comparar dos opciones de tela antes de tomar decisión.', subtotal: 4950000, discount: 150000, total: 4800000, validityDays: 15, deliveryTime: '25–30 días', paymentTerms: '', status: 'ACTIVA', convertedOrder: '', pdfUrl: '', advisor: 'Laura Gómez' },
      { number: 'MP-0247', date: ago(10), branch: 'MP', document: '76311842', client: 'Sergio Muñoz', phone: '3007182045', description: 'Comedor Mándala 6 puestos', observations: 'Pendiente confirmar acabado de madera y fecha estimada de entrega.', subtotal: 9350000, discount: 0, total: 9350000, validityDays: 15, deliveryTime: '25–30 días', paymentTerms: '', status: 'EN_SEGUIMIENTO', convertedOrder: '', pdfUrl: '', advisor: 'Alejandro Herrera' },
      { number: 'TP-0124', date: ago(14), branch: 'TP', document: '34670281', client: 'Paula Gómez', phone: '3162229180', description: 'Cama Milán y mesas de noche', observations: '', subtotal: 3200000, discount: 0, total: 3200000, validityDays: 15, deliveryTime: '25–30 días', paymentTerms: '', status: 'ACTIVA', convertedOrder: '', pdfUrl: '', advisor: 'Laura Gómez' },
      { number: 'MP-0239', date: ago(18), branch: 'MP', document: '1061734260', client: 'Andrés Burbano', phone: '3015507712', description: 'Sala Portobelo completa', observations: 'Sin respuesta después de enviar la propuesta. Requiere nuevo contacto comercial.', subtotal: 12400000, discount: 0, total: 12400000, validityDays: 15, deliveryTime: '25–30 días', paymentTerms: '', status: 'VENCIDA', convertedOrder: '', pdfUrl: '', advisor: 'Alejandro Herrera' },
      { number: 'MP-0235', date: ago(23), branch: 'MP', document: '1085314702', client: 'Juliana Paz', phone: '3189012477', description: 'Alcoba Turqueza', observations: 'Cotización convertida en orden de pedido.', subtotal: 5750000, discount: 0, total: 5750000, validityDays: 15, deliveryTime: '25–30 días', paymentTerms: '', status: 'CONVERTIDA', convertedOrder: 'MP-0084', pdfUrl: '', advisor: 'Alejandro Herrera' }
    ];
    return { ...common, msg: 'Datos demostrativos locales para validar seguimiento.', data: { items, total: items.length, amount: items.reduce((sum, item) => sum + item.total, 0) } };
  }
  if (action === 'SISTEMA_ESTADO') return { ...common, data: { appVersion: APP_CONFIG.version, mode: 'PREPARACION', commercialWrites: 'DESHABILITADAS', sheets: [], counts: { clients: 0, orders: 0, payments: 0, remissions: 0 } } };
  if (action === 'USUARIOS_LISTAR') return { ...common, data: { items: [], total: 0 } };
  return { ...common, data: {} };
}

export function homeUrl() {
  return withPreview(APP_CONFIG.homePath);
}
