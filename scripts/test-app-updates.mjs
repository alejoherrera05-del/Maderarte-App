import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watchRelease, trackUpdateSafety, showUpdateNotice } from '../public/js/core/app-updates.js';
import { beginRequest, hasActiveRequests } from '../public/js/core/request-activity.js';
import { releaseId, stampRelease } from './stamp-release.mjs';

const OLD = 'a'.repeat(24), NEW = 'b'.repeat(24);
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(fetchRelease) {
  const target = new EventTarget(), doc = new EventTarget();
  let tick, clock = 0, calls = 0, notices = 0, timerCleared = false;
  doc.visibilityState = 'visible';
  target.setInterval = callback => (tick = callback, 1);
  target.clearInterval = () => { timerCleared = true; };
  target.setTimeout = setTimeout; target.clearTimeout = clearTimeout;
  const stop = watchRelease({ current: OLD, target, doc, now: () => clock,
    fetchRelease: async (...args) => { calls++; return fetchRelease(...args); },
    onAvailable: id => { assert.equal(id, NEW); notices++; } });
  return { target, doc, stop, run: async () => { clock += 300_000; tick(); await flush(); },
    get calls() { return calls; }, get notices() { return notices; }, get stopped() { return timerCleared; } };
}
const response = id => ({ ok: true, json: async () => ({ schema: 1, id }) });
let latest = OLD;
const a = harness(async (url, options) => {
  assert.equal(url, '/release.json'); assert.equal(options.cache, 'no-store');
  assert.equal(options.credentials, 'omit'); return response(latest);
});
await flush(); assert.equal(a.notices, 0);
a.target.dispatchEvent(new Event('focus')); await flush(); assert.equal(a.calls, 1);
a.doc.visibilityState = 'hidden'; await a.run(); assert.equal(a.calls, 1);
latest = NEW; a.doc.visibilityState = 'visible'; a.doc.dispatchEvent(new Event('visibilitychange')); await flush();
assert.equal(a.notices, 1); assert.ok(a.stopped); await a.run(); assert.equal(a.notices, 1);
let resolve;
const b = harness(() => new Promise(r => { resolve = r; }));
await b.run(); b.target.dispatchEvent(new Event('online')); assert.equal(b.calls, 1);
resolve(response(OLD)); await flush(); b.stop();
for (const fetcher of [
  async () => { throw Error('offline'); },
  async () => ({ ok: false }),
  async () => ({ ok: true, json: async () => { throw Error('HTML instead of JSON'); } }),
  async () => response('invalid'),
  async () => ({ ok: true, json: async () => ({ schema: 2, id: NEW }) })
]) {
  const h = harness(fetcher); await flush(); await h.run();
  assert.equal(h.notices, 0); assert.equal(h.calls, 2); h.stop();
}
const c = harness(() => new Promise(r => { resolve = r; }));
c.stop(); resolve(response(NEW)); await flush(); assert.equal(c.notices, 0);

const dom = new JSDOM('<!doctype html><body><input id="name"><form role="search"><input type="search"></form></body>',
  { url: 'https://example.invalid/index.html' });
const doc = dom.window.document;
let busy = false, reloads = 0;
const safety = trackUpdateSafety({ doc, busy: () => busy });
doc.getElementById('name').focus();
const focused = doc.activeElement;
const notice = showUpdateNotice({ doc, safety, reload: () => reloads++ });
assert.equal(doc.activeElement, focused, 'The notice must not steal keyboard focus');
assert.equal(reloads, 0);
showUpdateNotice({ doc, safety }); assert.equal(doc.querySelectorAll('#maddy-update').length, 1);
busy = true; notice.querySelector('[data-update-now]').click(); assert.equal(reloads, 0);
assert.match(notice.textContent, /operación en curso/);
busy = false; notice.querySelector('[data-update-now]').click(); assert.equal(reloads, 1);
const input = doc.getElementById('name');
input.value = 'Contenido sin guardar'; input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
notice.querySelector('[data-update-now]').click(); assert.equal(reloads, 1);
assert.equal(input.value, 'Contenido sin guardar'); assert.match(notice.textContent, /Termina y guarda/);
notice.querySelector('[data-update-later]').click(); assert.equal(reloads, 1); assert.equal(doc.getElementById('maddy-update'), null);
safety.stop();

for (const path of ['pedido.html', 'cotizacion.html']) {
  dom.reconfigure({ url: 'https://example.invalid/' + path });
  const guard = trackUpdateSafety({ doc, busy: () => false });
  assert.ok(guard.reason(), 'A restored form is protected before typing'); guard.stop();
}
dom.reconfigure({ url: 'https://example.invalid/agenda.html' });
const guard = trackUpdateSafety({ doc, busy: () => false });
doc.body.innerHTML = '<dialog><form><input></form></dialog>';
assert.equal(guard.reason(), '');
doc.querySelector('dialog').setAttribute('open', '');
assert.ok(guard.reason());
doc.body.innerHTML = '<form role="search"><input type="search"></form>';
doc.querySelector('input').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
assert.equal(guard.reason(), '', 'Searching does not lock updates');
guard.stop(); dom.window.close();

const end1 = beginRequest(), end2 = beginRequest();
assert.ok(hasActiveRequests()); end1(); end1(); assert.ok(hasActiveRequests()); end2(); assert.equal(hasActiveRequests(), false);

// Exercise the actual request wrapper on success, HTTP failure and network failure.
globalThis.window = { crypto: { randomUUID: () => 'synthetic-request' }, location: { href: 'https://example.invalid/index.html', search: '' },
  setTimeout, clearTimeout, dispatchEvent() {}, Event };
const { apiRequest } = await import('../public/js/core/api.js');
const originalFetch = globalThis.fetch;
for (const mode of ['success', 'HTTP', 'network']) {
  globalThis.fetch = async () => {
    assert.ok(hasActiveRequests(), 'The full fetch/parse lifecycle is protected');
    if (mode === 'network') throw Error('offline');
    return { ok: mode === 'success', status: mode === 'success' ? 200 : 500,
      json: async () => ({ status: mode === 'success' ? 'success' : 'error' }) };
  };
  if (mode === 'success') await apiRequest('TEST_READ');
  else await assert.rejects(apiRequest('TEST_READ'));
  assert.equal(hasActiveRequests(), false, 'All outcomes release the in-flight guard');
}
globalThis.fetch = originalFetch; delete globalThis.window;

// Determinism, CRLF portability, changes to real assets and stale-marker rejection.
const root = mkdtempSync(join(tmpdir(), 'maddy-release-'));
try {
  for (const dir of ['public/js/core', 'worker', 'functions']) mkdirSync(join(root, dir), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'wrangler.toml']) writeFileSync(join(root, file), '{}');
  writeFileSync(join(root, 'public/index.html'), '<html>\n</html>\n');
  const first = stampRelease(root); assert.equal(stampRelease(root, true), first);
  assert.equal(stampRelease(root), first, 'Generated marker is excluded from its own hash');
  writeFileSync(join(root, 'public/index.html'), '<html>\r\n</html>\r\n');
  assert.equal(releaseId(root), first);
  writeFileSync(join(root, 'public/image.webp'), Buffer.from([0, 1, 2, 3]));
  assert.notEqual(releaseId(root), first);
  assert.throws(() => stampRelease(root, true), /stale/);
  stampRelease(root); assert.equal(JSON.parse(readFileSync(join(root, 'public/release.json'))).id, releaseId(root));
} finally { rmSync(root, { recursive: true, force: true }); }
console.log('Updates: detection, offline recovery, hidden tabs, deduplication, no automatic reload, form safety, request lifecycle and release integrity passed.');
