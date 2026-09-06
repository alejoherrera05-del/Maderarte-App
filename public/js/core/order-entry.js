import { PAYMENT_METHODS, summarizePayments } from './commercial-rules.js?v=agreements-1';
import { escapeHtml } from './format.js';

export function readOrderEntry(total, root = document) {
  const entries = [...root.querySelectorAll('[data-payment-row]')].map(row => ({
    method: row.querySelector('[data-payment-method]').value,
    amount: row.querySelector('[data-payment-amount]').value,
    internalNote: row.querySelector('[data-payment-note]').value
  }));
  const summary = summarizePayments(total, entries);
  const noPayment = Boolean(root.querySelector('#order-no-payment')?.checked);
  if (!summary.error && !noPayment && !summary.paid) {
    summary.error = 'Indica el abono de hoy o marca «Sin abono inicial».';
    summary.errorIndex = 0;
  }
  if (noPayment && entries.some(entry => entry.method || entry.amount || entry.internalNote)) {
    summary.error = 'Hay datos de un pago. Revísalos antes de marcar «Sin abono inicial».';
    summary.errorIndex = 0;
  }
  return { ...summary, noPayment };
}

export function bindOrderEntry(onChange) {
  const list = document.getElementById('order-payments');
  if (!list) return;
  let nextId = 1;
  const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  function renumber() {
    [...list.children].forEach((row, index) => {
      row.querySelector('[data-payment-title]').textContent = `Pago ${index + 1}`;
      row.querySelector('[data-remove-payment]').disabled = list.children.length === 1;
    });
  }
  function addPayment(restoredId) {
    const id = Number.isSafeInteger(restoredId) && restoredId > 0 ? restoredId : nextId++;
    nextId = Math.max(nextId, id + 1);
    const row = document.createElement('article');
    row.className = 'order-payment';
    row.dataset.paymentRow = String(id);
    row.innerHTML = `<div class="order-payment-head"><strong data-payment-title></strong><button class="quote-remove-item" type="button" data-remove-payment>Quitar</button></div>
      <div class="order-payment-fields">
        <div class="quote-field"><label for="order-payment-${id}-method">Medio de pago</label><select id="order-payment-${id}-method" data-payment-method><option value="">Seleccionar</option>${PAYMENT_METHODS.map(method => `<option value="${method.code}">${escapeHtml(method.label)}</option>`).join('')}</select></div>
        <div class="quote-field"><label for="order-payment-${id}-amount">Valor</label><input id="order-payment-${id}-amount" data-payment-amount type="text" inputmode="numeric" placeholder="$ 0" autocomplete="off"></div>
        <div class="quote-field order-payment-note"><label for="order-payment-${id}-note">Nota interna del pago (opcional)</label><input id="order-payment-${id}-note" data-payment-note type="text" placeholder="Cuenta receptora, banco o detalle para el equipo" autocomplete="off" aria-describedby="order-payment-privacy"></div>
      </div>`;
    list.append(row);
    row.addEventListener('input', onChange);
    row.addEventListener('change', onChange);
    const amount = row.querySelector('[data-payment-amount]');
    amount.addEventListener('blur', () => {
      const summary = summarizePayments(Number.MAX_SAFE_INTEGER, [{ amount: amount.value, method: 'EFECTIVO' }]);
      if (!summary.error && summary.paid) amount.value = money.format(summary.paid);
    });
    row.querySelector('[data-remove-payment]').addEventListener('click', () => {
      if (list.children.length <= 1) return;
      row.remove();
      renumber();
      onChange();
    });
    renumber();
    onChange();
  }
  document.getElementById('order-add-payment').addEventListener('click', () => {
    addPayment();
    list.lastElementChild.querySelector('select').focus({ preventScroll: true });
  });
  document.getElementById('order-no-payment')?.addEventListener('change', onChange);
  addPayment();
  return { addPayment, clear: () => list.replaceChildren() };
}
