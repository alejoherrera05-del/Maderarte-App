import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { quoteContext, quoteReader, syntheticQuotes } from './quote-test-context.mjs';

const dom = new JSDOM('<!doctype html><div id="tracking-app" hidden></div>', { url: 'https://app.example.com/cotizaciones.html' });
const { window } = dom;
const originalFetch = globalThis.fetch;
Object.assign(globalThis, { window, document: window.document });
const rows = syntheticQuotes(101);
const backend = quoteContext(rows);
let releaseSlow;
let legacyPartial = false;
const requests = [];
globalThis.fetch = async (_url, options) => {
  const { action, payload } = JSON.parse(options.body);
  assert.equal(action, 'COTIZACIONES_LISTAR');
  requests.push(payload);
  if (payload.query === 'lenta') await new Promise(resolve => { releaseSlow = resolve; });
  const data = backend.listQuotes_(payload, quoteReader);
  if (legacyPartial) { delete data.paginationVersion; delete data.summary; }
  return new Response(JSON.stringify({ status: 'success', data }), { status: 200 });
};
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await tick();
    if (document.getElementById('tracking-results')?.getAttribute('aria-busy') === 'false') return;
  }
  assert.fail('El seguimiento no terminó de cargar');
}
function search(value) {
  document.getElementById('tracking-search').value = value;
  document.getElementById('tracking-filter-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
}
try {
  const { writeSessionSnapshot } = await import('../public/js/core/session.js');
  writeSessionSnapshot({ profile: { uid: 'test-only', email: 'test@example.test', status: 'ACTIVO', branches: ['MP'] }, permissions: ['*'], expiresAt: new Date(Date.now() + 60000).toISOString() });
  await import('../public/js/pages/cotizaciones.js');
  await settled();
  assert.equal(document.querySelectorAll('.tracking-card').length, 50);
  assert.equal(document.getElementById('tracking-summary-count').textContent, '101');
  assert.match(document.getElementById('tracking-summary-amount').textContent, /10\.100/);
  assert.match(document.getElementById('tracking-result-count').textContent, /1–50 de 101/);
  document.getElementById('tracking-next').click();
  await settled();
  assert.equal(requests.at(-1).offset, 50);
  assert.match(document.getElementById('tracking-result-count').textContent, /51–100 de 101/);
  document.getElementById('tracking-next').click();
  await settled();
  assert.equal(document.querySelectorAll('.tracking-card').length, 1);
  assert.equal(document.getElementById('tracking-next').disabled, true);
  assert.equal(document.getElementById('tracking-summary-count').textContent, '101');

  search('QA-0101');
  await settled();
  assert.equal(requests.at(-1).offset, 0);
  assert.equal(requests.at(-1).query, 'QA-0101');
  assert.equal(document.querySelector('.tracking-doc-number').textContent, 'QA-0101');
  assert.equal(document.getElementById('tracking-summary-count').textContent, '1');

  search('lenta');
  await tick();
  search('QA-0001');
  await settled();
  releaseSlow();
  await tick();
  await tick();
  assert.equal(document.querySelector('.tracking-doc-number').textContent, 'QA-0001', 'Una respuesta vieja no puede sobrescribir la búsqueda actual');

  search('sin coincidencias');
  await settled();
  assert.equal(document.getElementById('tracking-summary-count').textContent, '0');
  assert.match(document.getElementById('tracking-results').textContent, /No hay cotizaciones/);

  legacyPartial = true;
  search('');
  await settled();
  assert.match(document.getElementById('tracking-results').textContent, /seguimiento completo/);
  assert.equal(document.getElementById('tracking-summary-count').textContent, '—', 'Un error no es un total cero ni parcial');
  console.log('OK · seguimiento real en DOM: 101 registros, tres páginas, búsqueda, carreras y backend anterior incompleto');
} finally {
  window.close();
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  delete globalThis.document;
}
