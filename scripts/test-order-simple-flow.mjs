import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(readFileSync('public/pedido.html', 'utf8'), { url: 'https://app.example.com/pedido.html' });
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  MutationObserver: window.MutationObserver
});
const originalFetch = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = async () => { apiCalls++; throw new Error('No network in simple order flow test'); };
const tick = () => new Promise(resolve => setImmediate(resolve));

try {
  const { writeSessionSnapshot } = await import('../public/js/core/session.js');
  writeSessionSnapshot({
    profile: { uid: 'qa-simple-order', email: 'qa@example.com', name: 'Asesor QA', status: 'ACTIVO', mainBranch: 'TP', branches: ['TP'] },
    permissions: ['ordenes.read', 'clientes.read'],
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  });

  await import('../public/js/pages/cotizacion.js');
  await tick();
  await import('../public/js/pages/pedido-simple-flow.js');
  await tick();

  const $ = selector => document.querySelector(selector);
  const set = (selector, value, event = 'input') => {
    const node = $(selector);
    node.value = value;
    node.dispatchEvent(new window.Event(event, { bubbles: true }));
    return node;
  };
  const clickPlan = (itemId, code) => {
    const input = $(`[data-item-id="${itemId}"] [data-order-item-plan][value="${code}"]`);
    assert.ok(input, `Plan ${code} exists for item ${itemId}`);
    input.checked = true;
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  $('[data-quote-branch="TP"]').click();
  await tick();
  assert.equal($('#quote-workspace').hidden, false);
  assert.equal($('.order-legacy-agreements') !== null, true, 'Legacy agreement data remains available for draft compatibility');

  set('#quote-client-document', '0000000001');
  set('#quote-client-name', 'Cliente simple');
  set('#quote-client-phone', '0000000002');
  set('#quote-client-email', 'N/A');
  set('#quote-client-address', 'Dirección de prueba');
  set('#quote-client-city', 'Ciudad de prueba');
  set('[data-item-id="1"] [data-field="description"]', 'Sala simple');
  set('[data-item-id="1"] [data-field="unitValue"]', '2000000');

  assert.equal(document.querySelectorAll('[data-item-id="1"] [data-order-item-plan]').length, 3);
  assert.equal($('[data-item-id="1"] [data-order-plan-chip]').textContent, 'Pendiente');

  clickPlan('1', 'ENTREGA_INMEDIATA');
  assert.equal($('#order-item-1-agreement').value, 'ENTREGA_HOY');
  assert.equal($('#order-item-1-fulfillment').value, 'DISPONIBLE');
  assert.equal($('[data-item-id="1"] [data-order-plan-chip]').textContent, 'Entrega inmediata');

  clickPlan('1', 'SEPARADO');
  assert.equal($('#order-item-1-agreement').value, 'SEPARADO');
  assert.equal($('#order-item-1-fulfillment').value, 'DISPONIBLE');

  clickPlan('1', 'SOLICITAR_FABRICA');
  assert.equal($('#order-item-1-agreement').value, 'ENTREGA_POSTERIOR');
  assert.equal($('#order-item-1-fulfillment').value, 'PARA_SOLICITAR');
  assert.match($('[data-item-id="1"] [data-order-plan-help]').textContent, /no registra todavía/i);

  $('#quote-add-item').click();
  await tick();
  set('[data-item-id="2"] [data-field="description"]', 'Comedor simple');
  set('[data-item-id="2"] [data-field="unitValue"]', '1500000');
  assert.equal(document.querySelectorAll('[data-item-id="2"] [data-order-item-plan]').length, 3);
  assert.equal($('[data-item-id="2"] [data-order-item-plan]:checked'), null, 'A new furniture line starts without silently inheriting the first item plan');

  $('#order-no-payment').click();
  $('#quote-preview-button').click();
  await new Promise(resolve => window.setTimeout(resolve, 220));
  assert.equal($('#quote-preview-overlay').classList.contains('is-open'), false);
  assert.equal(document.activeElement, $('[data-item-id="2"] [data-order-item-plan]'));
  assert.match($('[data-item-id="2"] [data-order-plan-help]').textContent, /Selecciona qué pasará/);

  clickPlan('2', 'SEPARADO');
  $('#quote-preview-button').click();
  await tick();
  assert.equal($('#quote-preview-overlay').classList.contains('is-open'), true);

  const { readCommercialValues } = await import('../public/js/core/commercial-form-values.js?v=agreements-1');
  const values = readCommercialValues();
  assert.deepEqual(values.items.map(item => item.agreement.code), ['ENTREGA_POSTERIOR', 'SEPARADO']);
  assert.deepEqual(values.items.map(item => item.fulfillment.code), ['PARA_SOLICITAR', 'DISPONIBLE']);
  assert.equal(apiCalls, 0, 'The simple flow does not create orders, payments, clients or remissions');
  console.log('OK · acuerdo simple dentro de cada mueble, mapeo interno, validación y vista previa');
} finally {
  window.close();
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.MutationObserver;
}
