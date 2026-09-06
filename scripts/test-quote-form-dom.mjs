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
  const preview = document.getElementById('quote-preview-button');
  const blockedAt = key => {
    preview.click();
    assert.equal(document.getElementById('quote-preview-overlay').classList.contains('is-open'), false);
    assert.equal(document.activeElement.id, `quote-client-${key}`);
  };
  const field = key => document.getElementById(`quote-client-${key}`);
  field('document').value = '0000000001';
  field('phone').value = '0000000001';
  blockedAt('email');
  field('email').value = 'N/A';
  blockedAt('address');
  field('address').value = 'Dirección de prueba';
  blockedAt('city');
  field('city').value = 'Ciudad de prueba';
  field('email').value = 'incorrecto'; blockedAt('email');
  field('email').value = 'cliente@example.com';
  preview.click();
  assert.equal(document.activeElement.dataset.field, 'description', 'Correo válido permite continuar a los muebles');
  field('email').value = 'N/A';
  preview.click();
  assert.equal(document.activeElement.dataset.field, 'description', 'N/A permite continuar sin inventar un correo');
  for (const key of ['document','name','phone','email','address','city']) assert.equal(field(key).required, true);
  assert.equal(field('alternatePhone').required, false);
  document.getElementById('quote-add-item').click();
  const inputs = [...document.querySelectorAll('.quote-item [data-field]')];
  assert.equal(new Set(inputs.map(input => input.id)).size, 14);
  assert.ok(inputs.every(input => input.labels.length === 1), 'Cada campo repetido necesita su propia etiqueta');
  console.log('OK · cotización exige datos completos, permite N/A, conserva el foco y etiquetas únicas por mueble');
} finally {
  window.close();
  delete globalThis.window;
  delete globalThis.document;
}
