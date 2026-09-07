import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createOrderSave, saveCapabilitiesReady, clearOrderSaveSnapshots } from '../public/js/core/order-save.js';
const ready = { enabled: true, contractVersion: 1, photosReady: true, documentsReady: true };
const body = () => ({ schemaVersion: 1, branch: 'MP', client: { document: '000001', name: 'Cliente sintético' },
  items: [{ clientLineId: '1', description: 'Mueble sintético' }], payments: [{ amount: 10, internalNote: 'PRIVADO-QA' }] });
const store = () => {
  const data = Object.create(null);
  return new Proxy(data, { get(target, name) {
    if (name === 'getItem') return key => target[key] ?? null;
    if (name === 'setItem') return (key, value) => { target[key] = String(value); };
    if (name === 'removeItem') return key => { delete target[key]; };
    return target[name];
  } });
};
const lockManager = () => {
  const held = new Set();
  return { async request(key, options, fn) {
    if (held.has(key)) return fn(null);
    held.add(key);
    try { return await fn({ name: key }); } finally { held.delete(key); }
  } };
};
let checks = 0;
const equal = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const ok = (value, msg) => { assert.ok(value, msg); checks++; };
function harness() {
  const durable = store(), temporary = store(), locks = lockManager();
  const calls = [], orders = new Map();
  let caps = ready, createMode = 'success', statusMode = 'normal', uid = 'qa-save', delay = null;
  const request = async (action, payload, options) => {
    calls.push({ action, payload: structuredClone(payload), options });
    if (action === 'ORDEN_CAPACIDADES') return { data: caps };
    if (action === 'ORDEN_CREAR') {
      if (delay) await delay;
      if (createMode === 'before-timeout') throw new Error('timeout before commit');
      if (createMode === 'input') throw Object.assign(new Error('Corrige el campo'), { code: 'ORDER_INPUT_INVALID', requestId: options.requestId });
      const order = { requestId: options.requestId, number: 'MP-OP-0001', branch: 'MP' };
      orders.set(options.requestId, order);
      if (createMode === 'after-timeout') throw new Error('lost response');
      if (createMode === 'wrong-id') return { data: { saved: true, order: { ...order, requestId: 'WRONG-REQUEST-00000001' } } };
      return { data: { saved: true, order } };
    }
    if (action === 'ORDEN_CREACION_ESTADO') {
      if (statusMode === 'offline') throw new Error('offline');
      if (orders.has(payload.requestId)) return { data: { saved: true, order: orders.get(payload.requestId) } };
      return { data: { saved: false, requestId: payload.requestId, state: statusMode === 'fence' ? 'REVISION_REQUERIDA' : 'NO_CONFIRMADO', retrySameRequest: statusMode !== 'fence' } };
    }
    throw new Error(`Unexpected action ${action}`);
  };
  const make = (temp = temporary, overrides = {}) => createOrderSave({ uid: 'qa-save', request, durable, temporary: temp, locks, crypto: webcrypto, activeUid: () => uid, ...overrides });
  return { make, durable, temporary, calls, orders, request, locks,
    setCaps: value => { caps = value; }, setMode: value => { createMode = value; }, setStatus: value => { statusMode = value; },
    setUid: value => { uid = value; }, setDelay: value => { delay = value; } };
}
for (const caps of [null, {}, { ...ready, enabled: 'true' }, { ...ready, contractVersion: 99 }, { ...ready, photosReady: false }, { ...ready, documentsReady: false }]) equal(saveCapabilitiesReady(caps), false);
equal(saveCapabilitiesReady(ready), true);
equal(saveCapabilitiesReady({ ...ready, contractVersion: 2 }), true, 'Documentary contract explicitly supported');
{
  const h = harness(), m = h.make(); h.setCaps({ ...ready, enabled: false });
  equal((await m.refresh()).phase, 'disabled'); equal((await m.save(body())).phase, 'disabled');
  equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 0); equal(h.durable.getItem(m.key), null);
}
{
  const h = harness(), m = h.make(); equal((await m.refresh()).canSave, true);
  let release; h.setDelay(new Promise(resolve => { release = resolve; }));
  const payload = body(), saving = m.save(payload); payload.payments[0].amount = 999;
  for (let i = 0; i < 100 && !h.calls.some(x => x.action === 'ORDEN_CREAR'); i++) await new Promise(resolve => setTimeout(resolve, 2));
  await m.save(body()); equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 1, 'double click');
  const second = h.make(store()); equal((await second.save(body())).phase, 'other-tab');
  equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 1, 'cross-tab lock');
  release(); const result = await saving;
  equal(result.phase, 'confirmed'); equal(result.ownsDraft, true);
  equal(h.calls.find(x => x.action === 'ORDEN_CREAR').payload.payments[0].amount, 10, 'immutable input');
  ok(!JSON.stringify(h.durable).includes('PRIVADO-QA'), 'journal has no commercial data');
  ok(!h.temporary.getItem(m.key).includes('PRIVADO-QA'), 'snapshot cleared after commit');
  equal((await h.make().refresh()).phase, 'confirmed', 'reload confirmed');
  equal((await second.refresh()).ownsDraft, false, 'other tab must keep unrelated draft');
  await m.save(body()); equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 1);
  equal((await m.startNew()).phase, 'new'); equal(h.durable.getItem(m.key), null);
}
{
  const h = harness(), m = h.make(); h.setMode('after-timeout');
  equal((await m.save(body())).phase, 'uncertain'); const id = JSON.parse(h.durable.getItem(m.key)).requestId;
  h.setCaps({ ...ready, enabled: false });
  const afterReload = h.make(); equal((await afterReload.refresh()).phase, 'confirmed', 'recovery despite disabled create');
  equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 1);
  equal(JSON.parse(h.durable.getItem(m.key)).requestId, id);
}
{
  const h = harness(), m = h.make(); h.setMode('before-timeout'); h.setStatus('fence');
  equal((await m.save(body())).phase, 'uncertain'); const raw = h.durable.getItem(m.key);
  equal((await m.refresh()).phase, 'uncertain'); equal((await m.retry()).phase, 'uncertain');
  equal((await m.startNew()).phase, 'uncertain'); equal(h.durable.getItem(m.key), raw);
  equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 1);
  const journal = JSON.parse(raw); h.orders.set(journal.requestId, { requestId: journal.requestId, number: 'MP-OP-0001', branch: 'MP' });
  equal((await h.make().refresh()).phase, 'confirmed', 'late commit recovered');
}
{
  const h = harness(), m = h.make(); h.setMode('before-timeout'); await m.save(body());
  const journal = JSON.parse(h.durable.getItem(m.key));
  equal((await m.refresh()).phase, 'retry'); h.setMode('success');
  equal((await m.retry()).phase, 'confirmed'); const attempts = h.calls.filter(x => x.action === 'ORDEN_CREAR');
  equal(attempts.length, 2); equal(attempts[0].options.requestId, attempts[1].options.requestId); equal(attempts[0].payload, attempts[1].payload);
  equal(journal.requestId, attempts[1].options.requestId);
}
{
  const h = harness(), m = h.make(); h.setMode('before-timeout'); await m.save(body());
  equal((await h.make(store()).refresh()).phase, 'uncertain', 'closed tab without snapshot cannot replay');
  const saved = JSON.parse(h.temporary.getItem(m.key)); saved.payload.payments[0].amount = 999;
  h.temporary.setItem(m.key, JSON.stringify(saved)); equal((await m.refresh()).phase, 'uncertain', 'tampered snapshot');
  await m.retry(); equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 1);
}
{
  const h = harness(), m = h.make(); h.setMode('wrong-id');
  equal((await m.save(body())).phase, 'uncertain', 'wrong confirmation must not redirect');
  equal(JSON.parse(h.durable.getItem(m.key)).stage, 'pending');
}
{
  const h = harness(), m = h.make(); h.setMode('input');
  equal((await m.save(body())).phase, 'rejected'); equal(h.durable.getItem(m.key), null);
  h.setMode('before-timeout'); await m.save(body()); h.setMode('input');
  equal((await m.retry()).phase, 'uncertain', 'later rejection cannot erase uncertain first attempt');
  ok(h.durable.getItem(m.key));
}
{
  const h = harness(), m = h.make(); h.setMode('before-timeout'); await m.save(body());
  const raw = h.durable.getItem(m.key); clearOrderSaveSnapshots(h.temporary);
  equal(h.temporary.getItem(m.key), null); equal(h.durable.getItem(m.key), raw, 'logout keeps journal');
  h.setUid('another-user'); const count = h.calls.length;
  await m.refresh(); equal(h.calls.length, count, 'no status query under another uid');
}
for (const failureStore of ['durable', 'temporary']) {
  const h = harness();
  const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const m = h.make(undefined, { [failureStore]: broken });
  equal((await m.save(body())).phase, 'blocked'); equal(h.calls.filter(x => x.action === 'ORDEN_CREAR').length, 0);
}
{
  const h = harness(), m = h.make(); h.durable.setItem(m.key, '{broken');
  equal((await m.save(body())).phase, 'blocked'); equal(h.calls.length, 0); equal(h.durable.getItem(m.key), '{broken');
}
{
  const h = harness(), m = h.make(undefined, { locks: null });
  equal((await m.save(body())).phase, 'blocked'); equal(h.calls.length, 0); equal(m.getState().locked, false, 'draft still editable when no pending save');
}
console.log(`OK · ${checks} comprobaciones del cliente: capacidades, doble clic, pestañas, recarga, respuesta perdida, repetición exacta, privacidad y fallo de almacenamiento. Sin tráfico a Google.`);
