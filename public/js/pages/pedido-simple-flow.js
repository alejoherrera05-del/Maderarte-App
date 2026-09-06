const ITEM_PLANS = Object.freeze({
  ENTREGA_INMEDIATA: Object.freeze({
    code: 'ENTREGA_INMEDIATA',
    label: 'Entrega inmediata',
    short: 'Entrega inmediata',
    description: 'Disponible para entregar ahora.',
    agreement: 'ENTREGA_HOY',
    fulfillment: 'DISPONIBLE',
    help: 'La remisión confirmará la entrega cuando realmente se realice.'
  }),
  SEPARADO: Object.freeze({
    code: 'SEPARADO',
    label: 'Separado / entregar después',
    short: 'Separado',
    description: 'Queda reservado para entregar más adelante.',
    agreement: 'SEPARADO',
    fulfillment: 'DISPONIBLE',
    help: 'Queda reservado y pendiente de una remisión posterior.'
  }),
  SOLICITAR_FABRICA: Object.freeze({
    code: 'SOLICITAR_FABRICA',
    label: 'Solicitar a fábrica',
    short: 'Solicitar a fábrica',
    description: 'Debe solicitarse o fabricarse antes de la entrega.',
    agreement: 'ENTREGA_POSTERIOR',
    fulfillment: 'PARA_SOLICITAR',
    help: 'Esta selección no registra todavía una solicitud a fábrica.'
  })
});

const PLAN_ORDER = ['ENTREGA_INMEDIATA', 'SEPARADO', 'SOLICITAR_FABRICA'];

function planFromStored(agreement, fulfillment) {
  if (agreement === 'ENTREGA_HOY') return ITEM_PLANS.ENTREGA_INMEDIATA;
  if (fulfillment === 'PARA_SOLICITAR') return ITEM_PLANS.SOLICITAR_FABRICA;
  if (agreement === 'SEPARADO' || (agreement === 'ENTREGA_POSTERIOR' && fulfillment === 'DISPONIBLE')) return ITEM_PLANS.SEPARADO;
  return null;
}

function documentPlanFromStored(agreement, fulfillment) {
  if (agreement === 'ENTREGA_HOY') return { code: 'ENTREGA_INMEDIATA', label: 'Entrega inmediata' };
  if (agreement === 'SEPARADO' && fulfillment === 'PARA_SOLICITAR') return { code: 'SOLICITAR_FABRICA', label: 'Separado · solicitar a fábrica' };
  if (fulfillment === 'PARA_SOLICITAR') return { code: 'SOLICITAR_FABRICA', label: 'Solicitar a fábrica' };
  if (agreement === 'SEPARADO') return { code: 'SEPARADO', label: 'Separado / entregar después' };
  if (agreement === 'ENTREGA_POSTERIOR') return { code: 'SEPARADO', label: 'Entrega posterior' };
  if (fulfillment === 'POR_DEFINIR') return { code: 'PENDIENTE', label: 'Por definir' };
  return null;
}

function storedControls(itemId) {
  return {
    agreement: document.getElementById(`order-item-${itemId}-agreement`),
    fulfillment: document.getElementById(`order-item-${itemId}-fulfillment`)
  };
}

function optionMarkup(itemId, code) {
  const plan = ITEM_PLANS[code];
  return `<label class="order-plan-option">
    <input type="radio" name="order-plan-${itemId}" value="${plan.code}" data-order-item-plan>
    <span class="order-plan-radio" aria-hidden="true"></span>
    <span class="order-plan-copy"><strong>${plan.label}</strong><small>${plan.description}</small></span>
  </label>`;
}

function planMarkup(itemId) {
  return `<section class="order-item-plan" data-order-plan-for="${itemId}">
    <div class="order-item-plan-heading">
      <div><strong>¿Qué se hará con este mueble?</strong><small>Selecciona solo lo que aplica a este producto.</small></div>
      <span class="order-plan-chip" data-order-plan-chip>Pendiente</span>
    </div>
    <div class="quote-field order-item-plan-field">
      <div class="order-plan-options" role="radiogroup" aria-label="Acuerdo para este mueble">
        ${PLAN_ORDER.map(code => optionMarkup(itemId, code)).join('')}
      </div>
    </div>
    <p class="order-plan-help" data-order-plan-help>Selecciona una opción para este mueble.</p>
  </section>`;
}

function syncCard(card) {
  if (!card) return;
  const itemId = card.dataset.itemId;
  const host = card.querySelector(`[data-order-plan-for="${itemId}"]`);
  if (!host) return;
  const controls = storedControls(itemId);
  if (!controls.agreement || !controls.fulfillment) return;
  const plan = planFromStored(controls.agreement.value, controls.fulfillment.value);
  host.querySelectorAll('[data-order-item-plan]').forEach(input => { input.checked = input.value === plan?.code; });
  const chip = host.querySelector('[data-order-plan-chip]');
  const help = host.querySelector('[data-order-plan-help]');
  if (chip) {
    const next = plan?.short || 'Pendiente';
    if (chip.textContent !== next) chip.textContent = next;
    chip.dataset.plan = plan?.code || 'PENDIENTE';
  }
  if (help && !host.classList.contains('is-plan-missing')) {
    const next = plan?.help || 'Selecciona una opción para este mueble.';
    if (help.textContent !== next) help.textContent = next;
  }
  host.classList.toggle('has-plan', Boolean(plan));
}

function dispatchChange(control) {
  const EventCtor = control.ownerDocument.defaultView.Event;
  control.dispatchEvent(new EventCtor('change', { bubbles: true }));
}

function applyPlan(card, code) {
  const plan = ITEM_PLANS[code];
  if (!plan) return;
  const controls = storedControls(card.dataset.itemId);
  if (!controls.agreement || !controls.fulfillment) return;
  controls.agreement.value = plan.agreement;
  controls.fulfillment.value = plan.fulfillment;
  dispatchChange(controls.agreement);
  controls.fulfillment.value = plan.fulfillment;
  dispatchChange(controls.fulfillment);
  syncCard(card);
}

function enhanceCard(card) {
  if (!card || card.dataset.simpleOrderReady === 'true') return;
  const details = card.querySelector('.quote-item-details');
  if (!details) return;
  card.dataset.simpleOrderReady = 'true';
  details.insertAdjacentHTML('beforebegin', planMarkup(card.dataset.itemId));
  const host = card.querySelector(`[data-order-plan-for="${card.dataset.itemId}"]`);
  host.querySelectorAll('[data-order-item-plan]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) applyPlan(card, input.value);
      host.classList.remove('is-plan-missing');
      host.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute('aria-invalid'));
      const error = host.querySelector('[data-field-error]');
      if (error) error.textContent = '';
      syncCard(card);
    });
  });
  syncCard(card);
}

function syncAll() {
  document.querySelectorAll('.quote-item').forEach(card => {
    enhanceCard(card);
    syncCard(card);
  });
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function polishPreview() {
  const target = document.getElementById('quote-preview-content');
  if (!target) return;

  target.querySelectorAll('.order-document-page .quote-editorial-eyebrow').forEach(node => setText(node, 'Detalle de compra'));
  target.querySelectorAll('.order-document-page .quote-editorial-section-head h2').forEach(node => setText(node, 'Muebles del pedido'));
  target.querySelectorAll('.order-document-page .quote-editorial-table-head').forEach(head => {
    if (head.children[1]) setText(head.children[1], 'Mueble / descripción');
  });
  target.querySelectorAll('.order-document-page .order-finance-paid dt').forEach(node => setText(node, 'Pagado hoy'));

  const cards = [...document.querySelectorAll('.quote-item')];
  target.querySelectorAll('.order-document-page .quote-editorial-item[data-continuation="false"]').forEach(item => {
    const position = Number(item.dataset.itemPosition || 0);
    const card = cards[position - 1];
    if (!card) return;
    const controls = storedControls(card.dataset.itemId);
    const plan = documentPlanFromStored(controls.agreement?.value, controls.fulfillment?.value);
    const label = item.querySelector('.order-document-agreement');
    if (!label || !plan) return;
    setText(label, plan.label);
    label.dataset.plan = plan.code;
  });

  target.querySelectorAll('.order-document-page .order-document-conditions p').forEach(node => {
    if (node.textContent.startsWith('Muebles por solicitar:')) {
      setText(node, 'Solicitar a fábrica: fabricación estimada de 25 a 30 días desde la confirmación de la solicitud.');
    }
  });
}

function observePreview() {
  const target = document.getElementById('quote-preview-content');
  if (!target) return;
  new MutationObserver(polishPreview).observe(target, { childList: true, subtree: true });
  polishPreview();
}

function firstMissingPlan() {
  return [...document.querySelectorAll('.quote-item')].find(card => {
    const controls = storedControls(card.dataset.itemId);
    return !planFromStored(controls.agreement?.value, controls.fulfillment?.value);
  }) || null;
}

function blockMissingPlan(event) {
  const trigger = event.target.closest?.('#quote-preview-button, #quote-summary-preview');
  if (!trigger) return;
  const card = firstMissingPlan();
  if (!card) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  enhanceCard(card);
  const host = card.querySelector(`[data-order-plan-for="${card.dataset.itemId}"]`);
  if (!host) return;
  host.classList.add('is-plan-missing');
  const help = host.querySelector('[data-order-plan-help]');
  if (help) help.textContent = 'Selecciona qué se hará con este mueble antes de revisar el pedido.';
  const first = host.querySelector('[data-order-item-plan]');
  first?.setAttribute('aria-invalid', 'true');
  host.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => first?.focus({ preventScroll: true }), 180);
}

function observe() {
  const items = document.getElementById('quote-items');
  if (items) new MutationObserver(syncAll).observe(items, { childList: true });
  const agreements = document.getElementById('order-agreement-items');
  if (agreements) new MutationObserver(syncAll).observe(agreements, { childList: true, subtree: true, characterData: true });
}

function boot() {
  syncAll();
  observe();
  observePreview();
  document.addEventListener('click', blockMissingPlan, true);
  window.addEventListener('pageshow', () => { syncAll(); polishPreview(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
