import vm from 'node:vm';
import { readFileSync } from 'node:fs';

export function quoteContext(rows, now = new Date()) {
  const context = vm.createContext({
    MADERARTE_APP: { MAX_PAGE_SIZE: 100 },
    listRows_: name => name === 'Cotizaciones' ? rows : [],
    normalizeCode_: value => String(value || '').trim().toUpperCase(),
    valueNumber_: value => Number(value) || 0,
    valueDateIso_: value => String(value || ''),
    parseJson_: (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } },
    now_: () => now,
    requirePermission_: (session, permission) => {
      if (!session.permissions.includes('*') && !session.permissions.includes(permission)) throw Object.assign(new Error('Sin permiso'), { appCode: 'PERMISSION_DENIED' });
    },
    appError_: (code, message, status) => Object.assign(new Error(message), { appCode: code, httpStatus: status })
  });
  vm.runInContext(readFileSync('apps-script/Quotes.gs', 'utf8'), context, { filename: 'Quotes.gs' });
  return context;
}

export const quoteReader = { permissions: ['cotizaciones.read'], profile: { branches: ['MP'] } };

export function syntheticQuotes(count, date = new Date().toISOString()) {
  return Array.from({ length: count }, (_, index) => ({
    Numero_Cotizacion: `QA-${String(index + 1).padStart(4, '0')}`,
    Fecha: date,
    Sede: 'MP',
    Nombre_Cliente: `Caso sintético ${index + 1}`,
    Total_Cotizado: 100,
    Estado: 'ACTIVA'
  }));
}
