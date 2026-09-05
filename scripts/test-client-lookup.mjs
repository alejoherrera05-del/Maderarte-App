import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { bindClientLookup } from '../public/js/core/client-lookup.js';

const dom = new JSDOM(readFileSync('public/cotizacion.html', 'utf8'));
const { window } = dom;
const doc = window.document;
const input = doc.getElementById('quote-client-document');
const list = doc.getElementById('quote-client-suggestions');
const message = doc.getElementById('quote-client-message');
const fields = Object.fromEntries(['name', 'phone', 'email', 'address', 'city'].map(key => [key, doc.getElementById(`quote-client-${key}`)]));
const records = [
  { document: '001234', name: 'Cliente sintético A', phone: '0000000001', email: 'a@example.test', address: 'Dirección sintética A', city: 'Ciudad A' },
  { document: '001299', name: 'Cliente sintético B', phone: '0000000002', email: 'b@example.test', address: 'Dirección sintética B', city: 'Ciudad B' }
];
const searches = [];
const loads = [];
let releaseSearch;
let releaseLoad;
let delayLoad = false;
const pause = () => new Promise(resolve => setTimeout(resolve, 2));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await pause(); }
  assert.fail('La interacción no terminó en el estado esperado');
}
function type(value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function key(value) { input.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
bindClientLookup({ input, list, message, fields, delay: 0,
  async search(query) {
    searches.push(query);
    if (query === '88') await new Promise(resolve => { releaseSearch = resolve; });
    if (query === '77') throw new Error('Consulta no disponible');
    return records.filter(item => item.document.includes(query)).map(({ document, name }) => ({ document, name }));
  },
  async load(document) {
    loads.push(document);
    if (delayLoad) await new Promise(resolve => { releaseLoad = resolve; });
    return records.find(item => item.document === document);
  }
});
try {
  assert.equal(doc.getElementById('quote-client-search'), null);
  assert.equal(doc.querySelector('.quote-field-grid-client input'), input);
  assert.equal(input.type, 'text', 'Las cédulas conservan ceros iniciales');
  type('0');
  await pause();
  assert.equal(searches.length, 0);
  type('0012');
  await until(() => !list.hidden);
  assert.equal(list.children.length, 2);
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(fields.name.value, '', 'Una coincidencia parcial no selecciona a otra persona');
  key('ArrowDown');
  assert.equal(list.firstElementChild.getAttribute('aria-selected'), 'true');
  key('Enter');
  await until(() => fields.address.value === records[0].address);
  assert.equal(input.value, '001234');
  assert.equal(loads.at(-1), '001234');
  assert.equal(list.hidden, true);
  assert.equal(doc.activeElement, input);

  type('001299');
  assert.equal(fields.name.value, '', 'Cambiar de documento no debe conservar al cliente anterior');
  await until(() => fields.name.value === records[1].name);
  assert.equal(fields.address.value, records[1].address, 'La ficha completa aporta también la dirección');
  fields.name.value = 'Nombre escrito a mano';
  fields.name.dispatchEvent(new window.Event('input', { bubbles: true }));
  type('9090');
  await until(() => message.textContent.includes('Sin coincidencias'));
  assert.equal(input.value, '9090');
  assert.equal(fields.name.value, 'Nombre escrito a mano');
  assert.equal(fields.phone.value, '');
  assert.equal(fields.address.value, '');

  type('88');
  await until(() => releaseSearch);
  type('0012');
  await until(() => !list.hidden);
  releaseSearch();
  await pause();
  assert.equal(list.children.length, 2, 'Una consulta vieja no puede borrar las coincidencias actuales');
  key('Escape');
  assert.equal(list.hidden, true);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  type('77');
  await until(() => message.classList.contains('is-error'));
  assert.equal(message.textContent, 'Consulta no disponible', 'Un error no significa cliente nuevo');

  type('0012');
  await until(() => !list.hidden);
  list.lastElementChild.click();
  await until(() => fields.name.value === records[1].name);
  assert.equal(input.value, '001299', 'Elegir con un toque carga la coincidencia seleccionada');

  delayLoad = true;
  type('001234');
  await until(() => releaseLoad);
  type('9090');
  releaseLoad();
  await until(() => message.textContent.includes('Sin coincidencias'));
  assert.equal(input.value, '9090');
  assert.equal(fields.name.value, '', 'Una ficha atrasada no puede completar otra cédula');
  delayLoad = false;
  releaseSearch = null;
  type('88');
  await until(() => releaseSearch);
  fields.name.focus();
  fields.name.value = 'Captura manual';
  releaseSearch();
  await pause();
  assert.equal(list.hidden, true, 'La lista no reaparece al continuar con otro campo');
  assert.equal(doc.activeElement, fields.name);
  assert.equal(fields.name.value, 'Captura manual');
  assert.equal(doc.getElementById('quote-submit').disabled, true);
  console.log('OK · cédula integrada: coincidencias, ficha completa, teclado, selección, cliente nuevo y respuestas atrasadas');
} finally { window.close(); }
