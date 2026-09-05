import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const denied = process.argv.includes('denied');
const dom = new JSDOM(readFileSync('public/pedido.html', 'utf8'), { url: 'https://app.example.com/pedido.html' });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document });
const originalFetch = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = async () => { apiCalls++; throw new Error('No se necesitan escrituras ni consecutivos.'); };
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
    const $ = selector => document.querySelector(selector);
    const set = (selector, value, event = 'input') => {
      const node = $(selector); node.value = value;
      node.dispatchEvent(new window.Event(event, { bubbles: true }));
      return node;
    };
    const amount = id => Number(document.getElementById(id).textContent.replace(/[^0-9]/g, ''));
    const preview = () => $('#quote-preview-button').click();
    const blockedAt = selector => {
      preview(); assert.equal($('#quote-preview-overlay').classList.contains('is-open'), false);
      assert.equal(document.activeElement, $(selector));
      assert.equal($(selector).getAttribute('aria-invalid'), 'true');
    };
    const mp = $('[data-quote-branch="MP"]');
    assert.equal(mp.hidden, true);
    mp.disabled = false; mp.click(); await tick();
    assert.equal($('#quote-workspace').hidden, true);
    $('[data-quote-branch="TP"]').click(); await tick();
    assert.equal($('#quote-meta-number').textContent, 'Borrador');
    assert.equal($('#quote-meta-branch').textContent, 'TP');
    assert.equal($('.quote-field-grid-client input').id, 'quote-client-document');
    assert.equal($('#quote-client-search'), null);
    assert.equal($('#order-separated'), null, 'El separado no puede afectar toda la orden');
    assert.equal($('.quote-item-details').open, false, 'Acabados y fotos son opcionales');
    blockedAt('#quote-client-document');
    // Assign this ID directly so this test never schedules a remote client search.
    $('#quote-client-document').value = '0000000001';
    blockedAt('#quote-client-name');
    set('#quote-client-name', 'Cliente sintético');
    blockedAt('#quote-client-phone');
    set('#quote-client-phone', '0000000001');
    blockedAt('[data-field="description"]');
    set('[data-field="description"]', 'Sala de revisión');
    blockedAt('[data-field="unitValue"]');
    set('[data-field="unitValue"]', '-50000');
    $('[data-field="unitValue"]').dispatchEvent(new window.Event('blur'));
    assert.equal($('[data-field="unitValue"]').value, '-50000');
    assert.equal($('#quote-total').textContent, '—');
    blockedAt('[data-field="unitValue"]');
    set('[data-field="unitValue"]', '2000000');
    for (const quantity of ['0', '1.5', '-2', '']) {
      set('[data-field="quantity"]', quantity); blockedAt('[data-field="quantity"]');
    }
    set('[data-field="quantity"]', '1');
    blockedAt('[data-item-agreement]');
    set('[data-item-agreement]', 'ENTREGA_HOY', 'change');
    assert.equal($('[data-availability-field]').hidden, true);
    blockedAt('[data-payment-method]');
    $('#order-no-payment').click();
    assert.equal($('#order-payment-editor').hidden, true);
    preview(); await tick();
    assert.equal($('#quote-preview-overlay').classList.contains('is-open'), true);
    $('#quote-preview-close').click();
    $('#order-no-payment').click();
    set('[data-payment-method]', 'TRANSFERENCIA');
    set('[data-payment-amount]', '2100000');
    set('[data-payment-note]', 'INTERNO-NO-PUBLICAR');
    assert.match($('#order-payment-error').textContent, /superan/);
    $('#quote-add-item').click();
    const second = $('.quote-item[data-item-id="2"]');
    set('[data-item-id="2"] [data-field="description"]', 'Comedor de revisión');
    set('[data-item-id="2"] [data-field="unitValue"]', '1500000');
    blockedAt('[data-item-id="2"] [data-item-agreement]');
    set('[data-item-id="2"] [data-item-agreement]', 'SEPARADO', 'change');
    blockedAt('[data-item-id="2"] [data-item-fulfillment]');
    set('[data-item-id="2"] [data-item-fulfillment]', 'PARA_SOLICITAR', 'change');
    assert.match(second.querySelector('[data-fulfillment-help]').textContent, /25 a 30 días/);
    assert.equal(amount('quote-total'), 3500000);
    assert.equal(amount('order-paid'), 2100000);
    assert.equal(amount('order-balance'), 1400000);
    const { readOrderEntry } = await import('../public/js/core/order-entry.js?v=agreements-1');
    const { readCommercialValues } = await import('../public/js/core/commercial-form-values.js?v=agreements-1');
    let values = readCommercialValues();
    assert.deepEqual(values.items.map(item => item.agreement.code), ['ENTREGA_HOY', 'SEPARADO']);
    assert.deepEqual(values.items.map(item => item.fulfillment.code), ['DISPONIBLE', 'PARA_SOLICITAR']);
    assert.equal(readOrderEntry(3500000).allocation.length, 0, 'No se inventa pago por mueble');
    $('#order-allocate-payments').click();
    blockedAt('[data-item-allocation]');
    set('[data-item-allocation="1"]', '2000000');
    set('[data-item-allocation="2"]', '100000');
    let entry = readOrderEntry(3500000);
    assert.equal(entry.allocationError, '');
    assert.deepEqual(entry.allocation.map(part => part.balance), [0, 1400000]);
    assert.doesNotMatch(JSON.stringify(entry), /INTERNO|internalNote/);
    assert.match($('#order-operational-summary').textContent, /Sala de revisión.*Se entrega hoy.*Comedor de revisión.*Queda separado/s);
    preview(); await tick();
    assert.equal($('#quote-preview-overlay').classList.contains('is-open'), true);
    assert.doesNotMatch($('#quote-preview-content').innerHTML, /INTERNO/);
    $('#quote-preview-close').click();
    set('#quote-discount', '350000');
    assert.equal(amount('quote-total'), 3150000);
    assert.match($('#order-allocation-error').textContent, /no superar/);
    set('[data-item-allocation="1"]', '1800000');
    set('[data-item-allocation="2"]', '300000');
    entry = readOrderEntry(3150000);
    assert.equal(entry.allocationError, '');
    assert.deepEqual(entry.allocation.map(part => part.net), [1800000,1350000]);
    assert.deepEqual(entry.allocation.map(part => part.balance), [0,1050000]);
    set('#quote-discount', '99999999');
    assert.equal($('#quote-discount').value, '99999999');
    assert.equal($('#quote-total').textContent, '—', 'El descuento inválido no se convierte en uno distinto');
    blockedAt('#quote-discount');
    set('#quote-discount', '350000');
    set('#quote-client-email', 'correo-invalido'); blockedAt('#quote-client-email');
    set('#quote-client-email', '');
    // Switching fulfillment cannot alter payments or imply an actual delivery.
    set('[data-item-id="2"] [data-item-fulfillment]', 'DISPONIBLE', 'change');
    assert.equal(amount('order-paid'), 2100000);
    assert.equal(readCommercialValues().items[1].agreement.code, 'SEPARADO');
    $('#order-allocate-payments').click();
    $('#order-add-payment').click();
    set('[data-payment-row="1"] [data-payment-amount]', '50000');
    set('[data-payment-row="2"] [data-payment-method]', 'ADDI');
    set('[data-payment-row="2"] [data-payment-amount]', '100000');
    assert.equal(amount('order-paid'), 150000);
    $('#order-no-payment').click();
    assert.match($('#order-payment-error').textContent, /Hay datos/);
    assert.equal($('#order-payment-editor').hidden, false);
    $('#order-no-payment').click();
    $('[data-payment-row="2"] [data-remove-payment]').click();
    assert.equal(amount('order-paid'), 50000);
    $('#order-allocate-payments').click();
    second.querySelector('[data-remove-item]').click();
    assert.equal($('[data-item-allocation="2"]'), null);
    assert.equal($('[data-item-allocation="1"]').value, '1800000', 'Eliminar un mueble no redistribuye abonos');
    assert.ok(readOrderEntry(1650000).allocationError);
    $('#order-allocate-payments').click();
    set('#quote-client-alternatePhone', '0000000002');
    $('#quote-change-branch').click(); $('[data-quote-branch="TP"]').click(); await tick();
    assert.equal($('#quote-client-name').value, 'Cliente sintético');
    assert.equal($('#quote-submit').disabled, true);
    assert.equal($('#quote-form').dispatchEvent(new window.Event('submit', { cancelable: true })), false);
    const stored = Object.keys(window.sessionStorage).find(key => key.startsWith('maderarte.form-draft.'));
    const draft = JSON.parse(window.sessionStorage.getItem(stored));
    assert.equal(draft.uid, 'qa-order');
    assert.deepEqual(draft.data.itemIds, [1]);
    assert.equal(draft.data.fields.find(field => field.id === 'quote-client-alternatePhone').value, '0000000002');
    assert.match($('#quote-draft-status').textContent, /pestaña/);
  }
  assert.equal(apiCalls, 0, 'No crea clientes, consecutivos, OP ni abonos');
  console.log(`OK · ${denied ? 'permiso de OP independiente' : 'venta mixta, separado por mueble, abonos libres y distribución opcional, números inválidos, borrador y privacidad'}`);
} finally {
  window.close(); globalThis.fetch = originalFetch;
  delete globalThis.window; delete globalThis.document;
}
