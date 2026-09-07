import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><main id="root"><aside class="od-stack"></aside></main></body>', { url: 'https://app.example.invalid/orden.html?op=MP-QA-OP-0001' });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document });
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
let finalize = 0;
const number = 'MP-QA-OP-0001';
const request = async action => {
  if (action === 'ORDEN_DOCUMENTOS_ESTADO') return { data: { number, complete: false, files: [{ id: 'pdf', type: 'OP', ready: false, url: '' }] } };
  if (action === 'ORDEN_DOCUMENTOS_FINALIZAR') { finalize++; throw new Error('Respuesta no confirmada de la misma orden.'); }
  throw new Error('Acción inesperada: ' + action);
};
try {
  const { bindOrderDocuments } = await import('../public/js/pages/orden-documentos.js');
  await bindOrderDocuments(document.getElementById('root'), number, request);
  const complete = document.querySelector('.od-document-button');
  for (let attempt = 0; attempt < 3; attempt++) {
    complete.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelectorAll('.order-progress-dialog').length, 1);
    assert.equal(document.querySelectorAll('#order-progress-title').length, 1);
    assert.equal(document.querySelectorAll('.order-progress-dialog[open]').length, 1);
    assert.equal(document.querySelector('[data-progress-step="document"]').dataset.state, 'unconfirmed');
    assert.equal(document.querySelector('.order-progress-return').hidden, false);
    document.querySelector('.order-progress-return').click();
    assert.equal(document.querySelector('.order-progress-dialog').open, false);
  }
  assert.equal(finalize, 3);
  console.log('OK · reintentos documentales reutilizan un solo diálogo y no crean pedidos ni pagos; servidor simulado.');
} finally {
  window.close();
  delete globalThis.window;
  delete globalThis.document;
}
