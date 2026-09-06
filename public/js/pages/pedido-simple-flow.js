const ITEM_PLANS = Object.freeze({
  ENTREGA_INMEDIATA: Object.freeze({
    code: 'ENTREGA_INMEDIATA',
    label: 'Entrega inmediata',
    short: 'Entrega inmediata',
    description: 'Está disponible y se coordina para entregar ahora.',
    agreement: 'ENTREGA_HOY',
    fulfillment: 'DISPONIBLE',
    help: 'La remisión será la que confirme después la entrega real.'
  }),
  SEPARADO: Object.freeze({
    code: 'SEPARADO',
    label: 'Separado / entregar después',
    short: 'Separado',
    description: 'Queda reservado para una entrega posterior.',
    agreement: 'SEPARADO',
    fulfillment: 'DISPONIBLE',
    help: 'El mueble queda pendiente hasta que se incluya en una remisión.'
  }),
  SOLICITAR_FABRICA: Object.freeze({
    code: 'SOLICITAR_FABRICA',
    label: 'Solicitar a fábrica',
    short: 'Solicitar a fábrica',
    description: 'Debe solicitarse o fabricarse antes de entregarlo.',
    agreement: 'ENTREGA_POSTERIOR',
    fulfillment: 'PARA_SOLICITAR',
    help: 'Elegir esta opción no registra todavía la solicitud a fábrica.'
  })
});

const PLAN_ORDER = ['ENTREGA_INMEDIATA', 'SEPARADO', 'SOLICITAR_FABRICA'];

function planFromStored(agreement, fulfillment) {
  if (agreement === 'ENTREGA_HOY') return ITEM_PLANS.ENTREGA_INMEDIATA;
  if (fulfillment === 'PARA_SOLICITAR') return ITEM_PLANS.SOLICITAR_FABRICA;
  if (agreement === 'SEPARADO' || (agreement === 'ENTREGA_POSTERIOR' && fulfillment === 'DISPONIBLE')) return ITEM_PLANS.SEPARADO;
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
      <div><strong>¿Qué pasará con este mueble?</strong><small>Define este producto, no toda la compra.</small></div>
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
    chip.textContent = plan?.short || 'Pendiente';
    chip.dataset.plan = plan?.code || 'PENDIENTE';
  }
  if (help) help.textContent = plan?.help || 'Selecciona una opción para este mueble.';
  host.classList.toggle('has-plan', Boolean(plan));
}

function applyPlan(card, code) {
  const plan = ITEM_PLANS[code];
  if (!plan) return;
  const controls = storedControls(card.dataset.itemId);
  if (!controls.agreement || !controls.fulfillment) return;
  controls.agreement.value = plan.agreement;
  controls.fulfillment.value = plan.fulfillment;
  controls.agreement.dispatchEvent(new Event('change', { bubbles: true }));
  controls.fulfillment.value = plan.fulfillment;
  controls.fulfillment.dispatchEvent(new Event('change', { bubbles: true }));
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
      host.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute('aria-invalid'));
      const error = host.querySelector('[data-field-error]');
      if (error) error.textContent = '';
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
  host.classList.add('is-plan-missing');
  const help = host.querySelector('[data-order-plan-help]');
  if (help) help.textContent = 'Selecciona qué pasará con este mueble antes de revisar el pedido.';
  const first = host.querySelector('[data-order-item-plan]');
  first?.setAttribute('aria-invalid', 'true');
  host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => first?.focus({ preventScroll: true }), 180);
}

function observe() {
  const items = document.getElementById('quote-items');
  if (items) new MutationObserver(syncAll).observe(items, { childList: true, subtree: true });
  const agreements = document.getElementById('order-agreement-items');
  if (agreements) new MutationObserver(syncAll).observe(agreements, { childList: true, subtree: true, characterData: true });
}

function boot() {
  syncAll();
  observe();
  document.addEventListener('click', blockMissingPlan, true);
  window.addEventListener('pageshow', syncAll);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
