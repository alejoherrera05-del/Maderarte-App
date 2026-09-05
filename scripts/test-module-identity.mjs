import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><title>Seguimiento · Maderarte App</title><main></main>', {
  url: 'https://app.example.com/cotizaciones.html'
});
const { window } = dom;
let deliveries = 0;
const observers = [];
// A broken observer would starve timers; cap notifications so a regression fails
// instead of hanging the test runner indefinitely.
class BoundedObserver extends window.MutationObserver {
  constructor(callback) {
    super((records, observer) => {
      deliveries += 1;
      if (deliveries >= 25) observer.disconnect();
      else callback(records, observer);
    });
    observers.push(this);
  }
}
Object.assign(globalThis, { window, document: window.document, MutationObserver: BoundedObserver });
try {
  await import('../public/js/core/module-identity.js');
  const main = document.querySelector('main');
  main.innerHTML = '<div class="module-brand"><span class="module-brand-section">Seguimiento comercial</span></div><footer class="module-footer-copy"><strong>Maderarte App</strong><span>Anterior</span></footer>';
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('footer strong').textContent, 'Maddy');
  assert.equal(document.querySelector('footer span').textContent, 'Seguimiento comercial · Maderarte');
  assert.equal(document.title, 'Seguimiento · Maddy');
  assert.ok(deliveries < 5, 'La identidad debe estabilizarse después del render tardío');

  deliveries = 0;
  main.appendChild(document.createElement('article'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deliveries, 1, 'Un cambio ajeno al pie no debe producir nuevas mutaciones');

  deliveries = 0;
  document.querySelector('.module-brand-section').textContent = 'Clientes';
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('footer span').textContent, 'Clientes · Maderarte');
  assert.ok(deliveries < 5, 'Cambiar de módulo también debe estabilizarse');
  console.log('OK · identidad Maddy estable en render tardío y cambios de página');
} finally {
  observers.forEach(observer => observer.disconnect());
  window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.MutationObserver;
}
