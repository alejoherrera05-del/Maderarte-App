const ORDER_ITEM_PLANS = Object.freeze({
  ENTREGA_AHORA: Object.freeze({
    code: 'ENTREGA_AHORA',
    label: 'Entrega ahora',
    short: 'Entrega ahora',
    description: 'Disponible y acordado para retiro o entrega inmediata.',
    message: 'Listo para incluir en una remisión cuando se entregue.'
  }),
  SEPARADO: Object.freeze({
    code: 'SEPARADO',
    label: 'Separado',
    short: 'Separado',
    description: 'Queda reservado para entregar después.',
    message: 'Queda reservado; podrá entregarse en una remisión posterior.'
  }),
  SOLICITAR_FABRICA: Object.freeze({
    code: 'SOLICITAR_FABRICA',
    label: 'Solicitar / fabricar',
    short: 'Solicitar / fabricar',
    description: 'Aún debe solicitarse o fabricarse.',
    message: 'Queda pendiente de solicitud o fabricación. No se marca como solicitado automáticamente.'
  })
});

const PLAN_ORDER = ['ENTREGA_AHORA', 'SEPARADO', 'SOLICITAR_FABRICA'];

function itemNumber(card) {
  return card.querySelector('[data-item-position]')?.textContent?.trim() || '';
}

function selectedPlan(card) {
  const value = card.querySelector('[data-order-item-plan]:checked')?.value || '';
  return ORDER_ITEM_PLANS[value] || null;
}

function planOptionsMarkup(itemId) {
  return PLAN_ORDER.map(code => {
    const plan = ORDER_ITEM_PLANS[code];
    return `<label class="order-item-plan-option">
      <input type="radio" name="order-item-plan-${itemId}" value="${plan.code}" data-order-item-plan>
      <span class="order-item-plan-dot" aria-hidden="true"></span>
      <span class="order-item-plan-copy"><strong>${plan.label}</strong><small>${plan.description}</small></span>
    </label>`;
  }).join('');
}

function buildPlanSection(card) {
  const itemId = card.dataset.itemId;
  const section = document.createElement('fieldset');
  section.className = 'order-item-plan';
  section.dataset.orderItemPlanSection = '';
  section.innerHTML = `<legend class="order-item-plan-heading">
      <span>¿Qué se acordó para este mueble?</span>
      <small>Solo para este producto.</small>
    </legend>
    <div class="order-item-plan-options">${planOptionsMarkup(itemId)}</div>
    <input type="hidden" data-field="fulfillment" value="">
    <p class="order-item-plan-message" data-order-item-plan-message>La remisión confirmará después lo que realmente se entregó.</p>
    <p class="order-item-quantity-note" data-order-item-quantity-note hidden>Si estas unidades tendrán acuerdos distintos, sepáralas en líneas diferentes.</p>`;
  return section;
}

function buildDetailsSection(card) {
  const details = document.createElement('details');
  details.className = 'order-item-details';
  details.innerHTML = `<summary>
      <span class="order-item-details-copy"><strong>Personalización y referencias</strong><small>Acabados, medidas, especificaciones y fotos</small></span>
      <span class="order-item-details-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="order-item-details-body"><div class="order-item-details-grid"></div></div>`;

  const grid = details.querySelector('.order-item-details-grid');
  ['.quote-item-fabric', '.quote-item-wood', '.quote-item-specifications'].forEach(selector => {
    const field = card.querySelector(selector);
    if (field) grid.appendChild(field);
  });

  const photoArea = card.querySelector('.quote-photo-area');
  if (photoArea) details.querySelector('.order-item-details-body').appendChild(photoArea);
  return details;
}

function updateQuantityNote(card) {
  const quantity = Number(card.querySelector('[data-field="quantity"]')?.value || 0);
  const note = card.querySelector('[data-order-item-quantity-note]');
  if (note) note.hidden = !(quantity > 1);
}

function updatePlanUI(card) {
  const plan = selectedPlan(card);
  const hidden = card.querySelector('[data-field="fulfillment"]');
  const message = card.querySelector('[data-order-item-plan-message]');
  if (hidden) hidden.value = plan?.code || '';
  if (message) message.textContent = plan?.message || 'La remisión confirmará después lo que realmente se entregó.';
  card.classList.toggle('has-order-item-plan', Boolean(plan));
  card.classList.remove('is-plan-missing');

  let chip = card.querySelector('[data-order-item-plan-chip]');
  if (!chip) {
    chip = document.createElement('span');
    chip.className = 'order-item-plan-chip';
    chip.dataset.orderItemPlanChip = '';
    const index = card.querySelector('.quote-item-index > div');
    index?.appendChild(chip);
  }
  chip.textContent = plan?.short || 'Acuerdo pendiente';
  chip.dataset.plan = plan?.code || 'PENDIENTE';
}

function enhanceCard(card) {
  if (!card || card.dataset.orderFlowReady === 'true') return;
  card.dataset.orderFlowReady = 'true';
  card.classList.add('order-item-card');

  const grid = card.querySelector('.quote-item-grid');
  if (!grid) return;

  const planSection = buildPlanSection(card);
  const details = buildDetailsSection(card);
  grid.insertAdjacentElement('afterend', planSection);
  planSection.insertAdjacentElement('afterend', details);

  planSection.querySelectorAll('[data-order-item-plan]').forEach(input => {
    input.addEventListener('change', () => updatePlanUI(card));
  });

  const quantity = card.querySelector('[data-field="quantity"]');
  quantity?.addEventListener('input', () => updateQuantityNote(card));

  updateQuantityNote(card);
  updatePlanUI(card);
}

function enhanceAllCards(root = document) {
  root.querySelectorAll?.('.quote-item').forEach(enhanceCard);
}

function firstMissingPlan() {
  return Array.from(document.querySelectorAll('.quote-item')).find(card => !selectedPlan(card)) || null;
}

function showMissingPlan(card) {
  card.classList.add('is-plan-missing');
  const message = card.querySelector('[data-order-item-plan-message]');
  if (message) message.textContent = `Selecciona qué se acordó para el mueble ${itemNumber(card) || ''}.`;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => card.querySelector('[data-order-item-plan]')?.focus({ preventScroll: true }), 260);
}

function validateBeforePreview(event) {
  const button = event.target.closest?.('#quote-preview-button, #quote-summary-preview');
  if (!button) return;
  const missing = firstMissingPlan();
  if (!missing) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showMissingPlan(missing);
}

function installItemsObserver() {
  const itemsRoot = document.getElementById('quote-items');
  if (!itemsRoot) return;
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      if (node.matches('.quote-item')) enhanceCard(node);
      else enhanceAllCards(node);
    }));
  });
  observer.observe(itemsRoot, { childList: true, subtree: true });
}

function boot() {
  enhanceAllCards();
  installItemsObserver();
  document.addEventListener('click', validateBeforePreview, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
