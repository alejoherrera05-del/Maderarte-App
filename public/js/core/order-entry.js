import { PAYMENT_METHODS, summarizePayments, paymentAmount, distributeDiscount } from './commercial-rules.js?v=agreements-1';
import { readCommercialValues } from './commercial-form-values.js?v=agreements-1';
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
  const values = readCommercialValues(root);
  const allocate = Boolean(root.querySelector('#order-allocate-payments')?.checked);
  const allocation = allocate ? distributeDiscount(values.items, values.discount).map(item => {
    const input = [...root.querySelectorAll('[data-item-allocation]')].find(node => node.dataset.itemAllocation === item.itemId);
    const amount = paymentAmount(input?.value);
    return { itemId: item.itemId, position: item.position, description: item.description,
      net: item.net, discount: item.discount, amount, balance: item.net - amount };
  }) : [];
  let allocationError = '';
  let allocationErrorId = '';
  if (allocate) {
    const invalid = allocation.find(item => !Number.isSafeInteger(item.amount) || item.amount > item.net);
    if (invalid) {
      allocationError = 'El abono de cada mueble debe ser válido y no superar su valor.';
      allocationErrorId = invalid.itemId;
    } else if (allocation.length !== values.items.length || allocation.reduce((sum, item) => sum + item.amount, 0) !== summary.paid) {
      allocationError = 'La distribución debe sumar exactamente el abono indicado. Revisa lo que falta por asignar.';
    }
  }
  return { ...summary, noPayment, allocate, allocation, allocationError, allocationErrorId };
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
  function addPayment() {
    const id = nextId++;
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
  document.getElementById('order-allocate-payments')?.addEventListener('change', onChange);
  addPayment();
}

export function syncOrderAllocation(values, onChange) {
  const root = document.getElementById('order-allocations');
  if (!root) return;
  const enabled = document.getElementById('order-allocate-payments').checked;
  root.hidden = !enabled;
  document.getElementById('order-allocation-help').hidden = !enabled;
  const netItems = distributeDiscount(values.items, values.discount);
  const ids = new Set(values.items.map(item => item.itemId));
  [...root.children].forEach(row => { if (!ids.has(row.dataset.allocationRow)) row.remove(); });
  for (const item of values.items) {
    let row = [...root.children].find(node => node.dataset.allocationRow === item.itemId);
    if (!row) {
      row = document.createElement('div');
      row.className = 'order-allocation-row';
      row.dataset.allocationRow = item.itemId;
      row.innerHTML = `<div class="quote-field"><label for="order-allocation-${item.itemId}"></label><span data-allocation-net></span><input id="order-allocation-${item.itemId}" data-item-allocation="${item.itemId}" type="text" inputmode="numeric" placeholder="$ 0" autocomplete="off"><span data-allocation-balance></span></div>`;
      row.querySelector('input').addEventListener('input', onChange);
      root.append(row);
    }
    row.querySelector('label').textContent = `Abono · ${item.description || `Mueble ${item.position}`}`;
    const net = netItems.find(entry => entry.itemId === item.itemId)?.net;
    const money = amount => Number.isSafeInteger(amount) ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(amount) : '—';
    row.querySelector('[data-allocation-net]').textContent = `Valor del mueble${values.discount > 0 ? ' con descuento' : ''}: ${money(net)}`;
    const allocated = paymentAmount(row.querySelector('input').value);
    row.querySelector('[data-allocation-balance]').textContent = `Saldo: ${net >= allocated ? money(net - allocated) : 'Revisa el abono'}`;
  }
}
