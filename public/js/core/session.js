import { APP_CONFIG } from './config.js';

function storageFor(persistence) {
  return persistence === 'local' ? window.localStorage : window.sessionStorage;
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function normalizePermissions(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(item => String(item ?? '').trim())
    .filter(Boolean)));
}

function normalizeProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    uid: String(source.uid ?? source.UID_Firebase ?? '').trim(),
    email: String(source.email ?? source.Email ?? '').trim().toLowerCase(),
    name: String(source.name ?? source.nombre ?? source.Nombre_Completo ?? '').trim(),
    role: String(source.role ?? source.rol ?? source.Rol ?? '').trim().toUpperCase(),
    status: String(source.status ?? source.estado ?? source.Estado ?? '').trim().toUpperCase(),
    mainBranch: String(source.mainBranch ?? source.sedePrincipal ?? source.Sede_Principal ?? '').trim().toUpperCase(),
    branches: Array.isArray(source.branches)
      ? source.branches.map(item => String(item).trim().toUpperCase()).filter(Boolean)
      : String(source.branches ?? source.sedesPermitidas ?? source.Sedes_Permitidas ?? '')
          .split(',').map(item => item.trim().toUpperCase()).filter(Boolean)
  };
}

export function readSessionSnapshot() {
  for (const persistence of ['session', 'local']) {
    const raw = storageFor(persistence).getItem(APP_CONFIG.sessionCacheKey);
    const value = safeParse(raw);
    if (!value || value.persistence !== persistence) continue;
    const expiresAtMs = Date.parse(String(value.expiresAt ?? ''));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      storageFor(persistence).removeItem(APP_CONFIG.sessionCacheKey);
      continue;
    }
    const profile = normalizeProfile(value.profile);
    if (!profile.uid || !profile.email || profile.status !== 'ACTIVO') continue;
    return { profile, permissions: normalizePermissions(value.permissions), expiresAt: value.expiresAt, validatedAt: Number(value.validatedAt || 0), persistence };
  }
  return null;
}

export function writeSessionSnapshot(session, persistence = 'session') {
  clearSessionSnapshot();
  const targetPersistence = persistence === 'local' ? 'local' : 'session';
  const normalized = { profile: normalizeProfile(session?.profile), permissions: normalizePermissions(session?.permissions), expiresAt: String(session?.expiresAt ?? ''), validatedAt: Date.now(), persistence: targetPersistence };
  storageFor(targetPersistence).setItem(APP_CONFIG.sessionCacheKey, JSON.stringify(normalized));
  return normalized;
}

export function clearSessionSnapshot() {
  window.localStorage.removeItem(APP_CONFIG.sessionCacheKey);
  window.sessionStorage.removeItem(APP_CONFIG.sessionCacheKey);
}

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') || `device-${Date.now()}`;
}

export function getDeviceId() {
  let id = window.localStorage.getItem(APP_CONFIG.deviceIdKey);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(APP_CONFIG.deviceIdKey, id);
  }
  return id;
}

export function setDeviceName(value) {
  const name = String(value || '').trim().slice(0, 80);
  if (name) window.localStorage.setItem(APP_CONFIG.deviceNameKey, name);
  else window.localStorage.removeItem(APP_CONFIG.deviceNameKey);
  return name;
}

export function getDeviceMetadata() {
  const ua = navigator.userAgent || '';
  let platform = 'Equipo';
  if (/iPhone/i.test(ua)) platform = 'iPhone';
  else if (/iPad/i.test(ua)) platform = 'iPad';
  else if (/Android/i.test(ua)) platform = 'Android';
  else if (/Windows/i.test(ua)) platform = 'PC Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) platform = 'Mac';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  let browser = 'Navegador';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/CriOS|Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  const customName = String(window.localStorage.getItem(APP_CONFIG.deviceNameKey) || '').trim();
  return {
    id: getDeviceId(),
    name: customName || `${platform} · ${browser}`,
    platform,
    browser,
    language: navigator.language || 'es-CO',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
  };
}
