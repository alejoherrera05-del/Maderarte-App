import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(readFileSync('public/cotizacion.html', 'utf8'), { url: 'http://localhost/cotizacion.html?preview=1' });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document });
try {
  await import('../public/js/pages/cotizacion.js');
  await new Promise(resolve => setImmediate(resolve));
  const branch = document.querySelector('[data-quote-branch="MP"]');
  branch.focus();
  branch.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.getElementById('quote-workspace').hidden, false);
  const name = document.getElementById('quote-client-name');
  name.focus();
  name.value = 'Cliente de prueba';
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(document.activeElement, name, 'Elegir sede no debe robar el foco mientras se escribe');
  assert.equal(name.value, 'Cliente de prueba');
  document.getElementById('quote-add-item').click();
  const inputs = [...document.querySelectorAll('.quote-item [data-field]')];
  assert.equal(new Set(inputs.map(input => input.id)).size, 14);
  assert.ok(inputs.every(input => input.labels.length === 1), 'Cada campo repetido necesita su propia etiqueta');
  console.log('OK · cotización conserva el foco del cliente y etiquetas únicas por mueble');
} finally {
  window.close();
  delete globalThis.window;
  delete globalThis.document;
}
