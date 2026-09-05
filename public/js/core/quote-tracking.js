const DAY_MS = 86_400_000;
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export function quoteDateInput(value = new Date()) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp - BOGOTA_OFFSET_MS).toISOString().slice(0, 10) : '';
}

export function quoteAgeDays(value, now = Date.now()) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now - BOGOTA_OFFSET_MS) / DAY_MS) - Math.floor((timestamp - BOGOTA_OFFSET_MS) / DAY_MS));
}

export function isQuoteClosed(item) {
  return Boolean(String(item.convertedOrder || '').trim()) || ['CONVERTIDA', 'ARCHIVADA', 'ANULADA'].includes(String(item.status || '').toUpperCase());
}

export function summarizeQuotes(items) {
  const summary = { activeCount: 0, activeAmount: 0, radar: { recent: 0, attention: 0, priority: 0 } };
  items.filter(item => !isQuoteClosed(item)).forEach(item => {
    summary.activeCount += 1;
    summary.activeAmount += Number(item.total) || 0;
    const age = quoteAgeDays(item.date);
    summary.radar[age <= 7 ? 'recent' : age <= 15 ? 'attention' : 'priority'] += 1;
  });
  return summary;
}

// Used for the local demo and for complete responses from the previous API.
// A partial legacy response must never look like a complete commercial report.
export function resolveQuotePage(data, filters, localDemo = false) {
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0) {
    throw new Error('No se pudo comprobar el listado de cotizaciones. Intenta actualizarlo.');
  }
  if (data.paginationVersion === 1 && data.summary && !localDemo) {
    if (data.offset !== filters.offset || data.limit !== filters.limit) {
      throw new Error('El listado cambió mientras se consultaba. Intenta actualizarlo.');
    }
    return data;
  }
  if (!localDemo && data.total > data.items.length) {
    throw new Error('No se pudo obtener el seguimiento completo. Intenta actualizarlo antes de consultar los totales.');
  }
  const query = String(filters.query || '').toLowerCase();
  const items = data.items.filter(item => {
    const day = quoteDateInput(item.date);
    if (filters.from && (!day || day < filters.from)) return false;
    if (filters.to && (!day || day > filters.to)) return false;
    if (filters.branch && item.branch !== filters.branch) return false;
    return !query || [item.number, item.document, item.client, item.phone, item.description, item.observations].join(' ').toLowerCase().includes(query);
  });
  return {
    items: items.slice(filters.offset, filters.offset + filters.limit),
    total: items.length,
    offset: filters.offset,
    limit: filters.limit,
    hasMore: filters.offset + filters.limit < items.length,
    summary: summarizeQuotes(items)
  };
}
