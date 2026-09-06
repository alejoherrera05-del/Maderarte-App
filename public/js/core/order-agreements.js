import { ITEM_AGREEMENTS, ITEM_FULFILLMENTS } from './commercial-rules.js?v=agreements-1';
import { escapeHtml } from './format.js';

export function bindOrderAgreements(onChange) {
  const root = document.getElementById('order-agreement-items');
  if (!root) return null;
  const common = document.getElementById('order-common-agreement');
  const availability = document.getElementById('order-common-fulfillment');
  const rows = () => [...root.querySelectorAll('[data-agreement-row]')];
  const find = id => rows().find(row => row.dataset.agreementRow === String(id));
  const selectors = '<option value="">Seleccionar</option>';
  function editor(row, open) {
    row.querySelector('[data-agreement-editor]').hidden = !open;
    const button = row.querySelector('[data-change-agreement]');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Listo' : 'Cambiar';
  }
  function create(id) {
    const row = document.createElement('article');
    row.className = 'order-agreement-item';
    row.dataset.agreementRow = String(id);
    row.dataset.agreementMode = 'inherit';
    row.innerHTML = `<div class="order-agreement-item-head"><div><strong data-agreement-title></strong><p data-agreement-summary></p><small data-agreement-source></small></div><button type="button" class="quote-change-branch" data-change-agreement aria-expanded="false" aria-controls="order-agreement-editor-${id}">Cambiar</button></div>
      <div id="order-agreement-editor-${id}" data-agreement-editor hidden>
        <div class="quote-field"><label for="order-item-${id}-agreement">Acuerdo para este mueble</label><select id="order-item-${id}-agreement" data-item-agreement required aria-describedby="order-item-${id}-agreement-help">${selectors}${ITEM_AGREEMENTS.map(option => `<option value="${option.code}">${escapeHtml(option.label)}</option>`).join('')}</select><p id="order-item-${id}-agreement-help" class="quote-helper" data-agreement-help></p></div>
        <div class="quote-field" data-availability-field hidden><label for="order-item-${id}-fulfillment">Disponibilidad de este mueble</label><select id="order-item-${id}-fulfillment" data-item-fulfillment aria-describedby="order-item-${id}-help">${selectors}${ITEM_FULFILLMENTS.map(option => `<option value="${option.code}">${escapeHtml(option.code === 'DISPONIBLE' ? 'Está disponible' : option.code === 'PARA_SOLICITAR' ? 'Necesita fábrica' : 'Aún por definir')}</option>`).join('')}</select><p class="quote-helper" id="order-item-${id}-help" data-fulfillment-help></p></div>
        <button type="button" class="order-use-common" data-use-common>Usar los valores de la compra</button>
      </div>`;
    row.querySelector('[data-change-agreement]').addEventListener('click', () => editor(row, row.querySelector('[data-agreement-editor]').hidden));
    row.querySelector('[data-use-common]').addEventListener('click', () => {
      row.dataset.agreementMode = 'inherit'; editor(row, false); onChange();
      row.querySelector('[data-change-agreement]').focus({ preventScroll: true });
    });
    row.querySelectorAll('select').forEach(input => input.addEventListener('change', () => { row.dataset.agreementMode = 'custom'; onChange(); }));
    root.append(row);
    return row;
  }
  function sync() {
    const cards = [...document.querySelectorAll('.quote-item')];
    const ids = new Set(cards.map(card => card.dataset.itemId));
    rows().forEach(row => { if (!ids.has(row.dataset.agreementRow)) row.remove(); });
    cards.forEach((card, index) => {
      const row = find(card.dataset.itemId) || create(card.dataset.itemId);
      const agreement = row.querySelector('[data-item-agreement]');
      const fulfillment = row.querySelector('[data-item-fulfillment]');
      if (row.dataset.agreementMode === 'inherit') { agreement.value = common.value; fulfillment.value = availability.value; }
      if (agreement.value === 'ENTREGA_HOY') fulfillment.value = 'DISPONIBLE';
      const choice = ITEM_AGREEMENTS.find(option => option.code === agreement.value);
      const source = ITEM_FULFILLMENTS.find(option => option.code === fulfillment.value);
      const description = card.querySelector('[data-field="description"]').value.trim();
      row.querySelector('[data-agreement-title]').textContent = `${String(index + 1).padStart(2, '0')} · ${description || 'Mueble sin descripción'}`;
      row.querySelector('[data-agreement-summary]').textContent = choice ? `${choice.label}${choice.code === 'ENTREGA_HOY' ? '' : source ? ` · ${source.label}` : ' · disponibilidad pendiente'}` : 'Selecciona el acuerdo de la compra o cambia este mueble.';
      row.querySelector('[data-agreement-source]').textContent = row.dataset.agreementMode === 'custom' ? 'Acuerdo individual' : 'Igual que la compra';
      row.querySelector('[data-agreement-help]').textContent = choice?.help || '';
      row.querySelector('[data-fulfillment-help]').textContent = source?.help || '';
      row.querySelector('[data-availability-field]').hidden = !choice || choice.code === 'ENTREGA_HOY';
      // Match the visible product order without changing stable IDs or focus.
      if (root.children[index] !== row) root.insertBefore(row, root.children[index] || null);
    });
    document.getElementById('order-common-availability').hidden = !common.value || common.value === 'ENTREGA_HOY';
    const individual = rows().filter(row => row.dataset.agreementMode === 'custom').length;
    document.getElementById('order-common-help').textContent = `Aplica a ${cards.length - individual} ${cards.length - individual === 1 ? 'mueble' : 'muebles'}.${individual ? ` ${individual} ${individual === 1 ? 'conserva su acuerdo individual' : 'conservan sus acuerdos individuales'}.` : ' Puedes cambiar solo los que sean distintos.'}`;
  }
  for (const input of [common, availability]) input.addEventListener('change', onChange);
  return {
    sync,
    modes: () => Object.fromEntries(rows().map(row => [row.dataset.agreementRow, row.dataset.agreementMode])),
    restoreModes: modes => rows().forEach(row => { row.dataset.agreementMode = modes?.[row.dataset.agreementRow] === 'inherit' ? 'inherit' : 'custom'; }),
    captureItem: id => { const row = find(id); return row ? { mode: row.dataset.agreementMode, agreement: row.querySelector('[data-item-agreement]').value, fulfillment: row.querySelector('[data-item-fulfillment]').value } : null; },
    restoreItem: (id, data) => { const row = find(id); if (!row || !data) return; row.dataset.agreementMode = data.mode === 'inherit' ? 'inherit' : 'custom'; row.querySelector('[data-item-agreement]').value = data.agreement; row.querySelector('[data-item-fulfillment]').value = data.fulfillment; },
    reveal: input => { const row = input?.closest('[data-agreement-row]'); if (row) editor(row, true); },
    validationTarget: (id, field) => { const row = find(id); return row?.dataset.agreementMode === 'inherit' ? (field === 'agreement' ? common : availability) : row?.querySelector(`[data-item-${field}]`); }
  };
}
