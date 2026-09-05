import assert from 'node:assert/strict';
import { quoteContext, quoteReader, syntheticQuotes } from './quote-test-context.mjs';
import { resolveQuotePage, quoteAgeDays, quoteDateInput } from '../public/js/core/quote-tracking.js';

const now = new Date('2026-09-05T17:00:00Z');
const rows = syntheticQuotes(101, now.toISOString());
rows.push({ ...rows[0], Numero_Cotizacion: 'TP-EXCLUDED', Sede: 'TP', Total_Cotizado: 9000 });
rows.push({ ...rows[0], Numero_Cotizacion: 'QA-CLOSED', Estado: 'CONVERTIDA', Convertida_OP: 'OP-TEST', Total_Cotizado: 500 });
const backend = quoteContext(rows, now);
const filters = { limit: 50, offset: 0, from: '2026-09-05', to: '2026-09-05', branch: '', query: '' };
const first = backend.listQuotes_(filters, quoteReader);
assert.equal(first.total, 102);
assert.equal(first.items.length, 50);
assert.equal(first.summary.activeCount, 101);
assert.equal(first.summary.activeAmount, 10100);
assert.equal(first.summary.radar.recent, 101);
assert.equal(first.amount, 10600);
assert.equal(first.hasMore, true);
const second = backend.listQuotes_({ ...filters, offset: 50 }, quoteReader);
const third = backend.listQuotes_({ ...filters, offset: 100 }, quoteReader);
assert.equal(new Set([...first.items, ...second.items, ...third.items].map(item => item.number)).size, 102);
assert.equal(third.hasMore, false);
assert.equal(third.summary.activeAmount, 10100);
assert.equal(resolveQuotePage(third, { ...filters, offset: 100 }).summary.activeCount, 101);

const match = backend.listQuotes_({ ...filters, query: 'QA-0101' }, quoteReader);
assert.equal(match.total, 1);
assert.equal(match.items[0].number, 'QA-0101');
assert.equal(match.summary.activeAmount, 100);
assert.equal(backend.listQuotes_({ ...filters, query: 'TP-EXCLUDED' }, quoteReader).total, 0);
assert.throws(() => backend.listQuotes_({ branch: 'TP' }, quoteReader), error => error.appCode === 'BRANCH_NOT_ALLOWED');
assert.throws(() => backend.listQuotes_({}, { permissions: [] }), error => error.appCode === 'PERMISSION_DENIED');
for (const payload of [{ offset: -1 }, { offset: 1.5 }, { limit: 'invalid' }]) {
  assert.throws(() => backend.listQuotes_(payload, quoteReader), error => error.appCode === 'QUOTE_PAGE_INVALID');
}
for (const from of ['2026-02-30', 'invalid']) {
  assert.throws(() => backend.listQuotes_({ from }, quoteReader), error => error.appCode === 'QUOTE_DATE_INVALID');
}
assert.throws(() => backend.listQuotes_({ from: '2026-09-06', to: '2026-09-05' }, quoteReader), error => error.appCode === 'QUOTE_DATE_RANGE_INVALID');
assert.equal(backend.quoteDateInRange_('2026-09-06T04:59:59.999Z', '2026-09-05', '2026-09-05'), true);
assert.equal(backend.quoteDateInRange_('2026-09-06T05:00:00Z', '2026-09-05', '2026-09-05'), false);
assert.equal(backend.quoteDateInRange_('invalid', '2026-09-05', ''), false);
assert.equal(quoteDateInput('2026-09-06T04:59:59Z'), '2026-09-05');
assert.equal(quoteAgeDays('2026-09-05T23:00:00-05:00', Date.parse('2026-09-06T00:01:00-05:00')), 1);

assert.throws(() => resolveQuotePage({ items: first.items, total: 102 }, filters), /seguimiento completo/);
const empty = resolveQuotePage({ items: [], total: 0 }, filters);
assert.equal(empty.summary.activeCount, 0);
const demo = resolveQuotePage({ items: [...first.items, ...second.items, ...third.items], total: 102 }, filters, true);
assert.equal(demo.total, 102);
assert.equal(demo.items.length, 50);
assert.equal(demo.summary.activeAmount, 10100);
console.log('OK · 101 propuestas abiertas, filtros completos, páginas sin omisiones, permisos y fechas de Bogotá');
