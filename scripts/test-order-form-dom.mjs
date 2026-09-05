import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const denied = process.argv.includes('denied');
const dom = new JSDOM(readFileSync('public/pedido.html', 'utf8'), { url: 'https://app.example.com/pedido.html' });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document });
const originalFetch = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = async () => { apiCalls++; throw new Error('El borrador no necesita consumir consecutivos ni escribir.'); };
const tick = () => new Promise(resolve => setImmediate(resolve));
try {
  const { writeSessionSnapshot } = await import('../public/js/core/session.js');
  writeSessionSnapshot({
    profile: { uid: 'qa-order', email: 'qa@example.com', name: 'Asesor de revisión', status: 'ACTIVO', mainBranch: 'TP', branches: ['TP'] },
    permissions: denied ? ['cotizaciones.read'] : ['ordenes.read', 'clientes.read'],
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  });
  await import('../public/js/pages/cotizacion.js');
  await tick();
  if (denied) {
    assert.match(document.body.textContent, /No tienes autorización/);
    assert.equal(document.getElementById('quote-form'), null);
  } else {
    const mp = document.querySelector('[data-quote-branch="MP"]');
    const tp = document.querySelector('[data-quote-branch="TP"]');
    assert.equal(mp.hidden, true);
    // Even a synthetic click must not select a branch outside the session.
    mp.disabled = false;
    mp.click();
    await tick();
    assert.equal(document.getElementById('quote-workspace').hidden, true);
    tp.click();
    await tick();
    assert.equal(document.getElementById('quote-workspace').hidden, false);
    assert.equal(document.getElementById('quote-meta-number').textContent, 'Borrador');
    assert.equal(document.getElementById('quote-meta-advisor').textContent, 'Asesor de revisión');
    assert.equal(document.getElementById('quote-meta-branch').textContent, 'TP');
    assert.equal(document.querySelector('.quote-field-grid-client input').id, 'quote-client-document');
    assert.equal(document.getElementById('quote-client-search'), null);
    assert.equal(document.getElementById('quote-client-document').type, 'text');
    assert.match(document.getElementById('quote-client-address').labels[0].textContent, /entrega/);
    const name = document.getElementById('quote-client-name');
    name.value = 'Cliente de revisión';
    name.focus();
    await new Promise(resolve => setTimeout(resolve, 360));
    assert.equal(document.activeElement, name);
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    set('[data-field="quantity"]', '2');
    set('[data-field="unitValue"]', '1000000');
    set('#quote-discount', '100000');
    const amount = id => Number(document.getElementById(id).textContent.replace(/[^0-9]/g, ''));
    assert.equal(amount('quote-subtotal'), 2000000);
    assert.equal(amount('quote-total'), 1900000);
    assert.equal(amount('quote-minimum-deposit'), 570000);
    assert.equal(amount('quote-remaining'), 1330000);
    set('#quote-discount', '99999999');
    assert.equal(amount('quote-total'), 0, 'El descuento no puede crear un total negativo');
    document.getElementById('quote-add-item').click();
    assert.equal(document.querySelectorAll('.quote-item').length, 2);
    document.querySelectorAll('[data-remove-item]')[1].click();
    assert.equal(document.querySelectorAll('.quote-item').length, 1);
    assert.equal(document.querySelector('[data-remove-item]').disabled, true);
    document.getElementById('quote-change-branch').click();
    tp.click();
    await tick();
    assert.equal(name.value, 'Cliente de revisión', 'Cambiar de sede no borra los datos');
    assert.equal(document.getElementById('quote-submit').disabled, true);
    assert.equal(document.getElementById('quote-form').dispatchEvent(new window.Event('submit', { cancelable: true })), false);
  }
  assert.equal(apiCalls, 0, 'La apertura del borrador no llama metadatos de cotización ni escrituras');
  console.log(`OK · pedido ${denied ? 'rechaza permiso de cotización sin permiso de OP' : 'respeta sede, cédula, foco, cálculos, un mueble mínimo y preparación sin escrituras'}`);
} finally {
  window.close();
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  delete globalThis.document;
}
