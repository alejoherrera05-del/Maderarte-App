const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function text(value, fallback = '—') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

export function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? moneyFormatter.format(number) : '—';
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const [, day, month, year, hour = '0', minute = '0', second = '0'] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function date(value) {
  const parsed = parseDate(value);
  return parsed ? dateFormatter.format(parsed) : '—';
}

export function dateTime(value) {
  const parsed = parseDate(value);
  return parsed ? dateTimeFormatter.format(parsed) : '—';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function safeInternalUrl(value, fallback = '/') {
  try {
    const url = new URL(String(value ?? '').trim(), window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function initials(value) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'MA';
  return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
}

export function statusTone(value) {
  const code = normalizeCode(value);
  if (['COMPLETADA', 'COMPLETADO', 'ACTIVO', 'ACTIVA', 'LISTA', 'EMITIDA', 'CONVERTIDA'].includes(code)) return 'success';
  if (['PENDIENTE', 'EN_PROCESO', 'BORRADOR', 'INVITADO'].includes(code)) return 'warning';
  if (['ANULADA', 'ANULADO', 'DESACTIVADO', 'SUSPENDIDO', 'REVOCADA', 'VENCIDA'].includes(code)) return 'danger';
  return 'info';
}

export function humanizeCode(value) {
  const code = normalizeCode(value);
  if (!code) return '—';
  return code.toLowerCase().replace(/_/g, ' ').replace(/^\w|\s\w/g, letter => letter.toUpperCase());
}
