import assert from 'node:assert/strict';
import { paginateQuoteDocument } from '../public/js/core/quote-pagination.js';

const fields = ['description', 'category', 'fabric', 'wood', 'specifications'];
const item = index => ({ position: index, description: `Mueble ${index}`, category: 'SALA', fabric: '', wood: '', specifications: '', quantity: 1, unitValue: 100, subtotal: 100 });
const weight = page => 10 + (page.client ? 20 : 0) + (page.closing ? 30 : 0) + page.notes.length / 5 + page.items.reduce((sum, entry) => sum + 15 + fields.reduce((n, field) => n + String(entry[field] || '').length / 5, 0), 0);
const fits = page => weight(page) <= 100;

for (const data of [
  { items: [item(1)], notes: '' },
  { items: Array.from({ length: 25 }, (_, index) => item(index + 1)), notes: 'Condición de prueba.' },
  { items: [{ ...item(1), specifications: 'Especificación completa sin pérdida de contenido. '.repeat(130) }, item(2)], notes: 'Observación extensa para revisión. '.repeat(160) },
  { items: [{ ...item(1), description: 'Nombre muy detallado del producto. '.repeat(80), fabric: 'Tejido '.repeat(80), wood: 'Madera '.repeat(80) }], notes: '' },
  { items: [{ ...item(1), specifications: 'X'.repeat(2000) }], notes: 'Y'.repeat(2000) },
  { items: [], notes: 'Sin productos' }
]) {
  const before = JSON.stringify(data);
  const pages = paginateQuoteDocument(data, fits);
  assert.ok(pages.every(fits), 'Cada página debe respetar la capacidad medida');
  assert.equal(pages.filter(page => page.client).length, 1);
  assert.equal(pages.filter(page => page.closing).length, 1);
  assert.equal(pages.at(-1).closing, true);
  assert.equal(pages.map(page => page.notes).join('').replace(/\s/g, ''), data.notes.replace(/\s/g, ''));
  const fragments = pages.flatMap(page => page.items);
  assert.deepEqual(fragments.filter(entry => !entry.continuation).map(entry => entry.position), data.items.map(entry => entry.position));
  for (const source of data.items) {
    const pieces = fragments.filter(entry => entry.position === source.position);
    for (const field of fields) {
      // A word without spaces may split at a physical page edge.
      const actual = pieces.map(entry => entry[field] || '').join('');
      assert.equal(actual.replace(/\s/g, ''), String(source[field] || '').replace(/\s/g, ''));
    }
  }
  assert.equal(JSON.stringify(data), before, 'La paginación no altera el formulario ni sus totales');
}
const one = { items: [item(1)], notes: '' };
assert.equal(paginateQuoteDocument(one, () => true).length, 1, 'El documento aprobado de una página se conserva cuando cabe');
assert.throws(() => paginateQuoteDocument(one, () => false), /cliente no cabe/);
console.log('OK · páginas medidas: 25 muebles, texto extenso, continuidad, contenido completo y un único cierre');
