const v5Style = document.createElement('link');
v5Style.rel = 'stylesheet';
v5Style.href = '/css/maddy-quote-v5.css?v=1';
document.head.appendChild(v5Style);

const previewMode = new URLSearchParams(location.search).get('preview') === '1';
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/* A small Maderarte story moment gives the shell identity without painting the UI orange. */
const sidebar = document.querySelector('.mq-sidebar');
if (sidebar && !sidebar.querySelector('.mq5-brand-story')) {
  const story = document.createElement('div');
  story.className = 'mq5-brand-story';
  story.setAttribute('aria-hidden', 'true');
  story.innerHTML = '<span>Madera que hace hogar.</span>';
  sidebar.appendChild(story);
}

/* Client data is an editing form only while it needs to be. Once identified it becomes an object. */
const clientSection = document.querySelector('.quote-editor > .quote-editor-section');
const clientGrid = document.querySelector('.quote-field-grid-client');
let clientEditLocked = false;

function value(id) { return String(document.getElementById(id)?.value || '').trim(); }
function clientRequiredComplete() {
  return ['quote-client-document','quote-client-name','quote-client-phone','quote-client-email','quote-client-address','quote-client-city'].every(id => value(id));
}
function clientCanSummarize() {
  return clientRequiredComplete() || (previewMode && value('quote-client-document') && value('quote-client-name'));
}

let clientSummary = null;
if (clientSection && clientGrid) {
  clientSummary = document.createElement('div');
  clientSummary.className = 'mq5-client-summary';
  clientSummary.innerHTML = `
    <span class="mq5-client-avatar"><img src="/assets/icons/users-three.svg" alt="" aria-hidden="true"></span>
    <span class="mq5-client-copy"><strong></strong><span></span></span>
    <button class="mq5-client-edit" type="button">Editar</button>`;
  clientGrid.insertAdjacentElement('beforebegin', clientSummary);
  clientSummary.querySelector('.mq5-client-edit')?.addEventListener('click', () => {
    clientEditLocked = true;
    clientSection.classList.remove('mq5-client-collapsed');
    document.getElementById('quote-client-document')?.focus({ preventScroll: true });
  });
}

function refreshClientObject() {
  if (!clientSection || !clientSummary) return;
  const name = value('quote-client-name') || 'Cliente por identificar';
  const documentNumber = value('quote-client-document');
  const city = value('quote-client-city');
  const phone = value('quote-client-phone');
  const email = value('quote-client-email');
  clientSummary.querySelector('strong').textContent = name;
  clientSummary.querySelector('.mq5-client-copy span').textContent = [documentNumber ? `CC/NIT ${documentNumber}` : '', city, phone, email].filter(Boolean).join(' · ') || 'Completa los datos del cliente';
  const canCollapse = clientCanSummarize();
  if (!canCollapse) clientEditLocked = false;
  clientSection.classList.toggle('mq5-client-collapsed', canCollapse && (!clientEditLocked || previewMode));
}

document.getElementById('quote-form')?.addEventListener('input', event => {
  if (event.target.closest?.('.quote-field-grid-client')) {
    clientEditLocked = !clientRequiredComplete();
    refreshClientObject();
  }
});
document.getElementById('quote-form')?.addEventListener('change', refreshClientObject);

/* Furniture cards receive a visual object layer while the original inputs remain the source of truth. */
const CATEGORY_IMAGE = {
  SALA: '/assets/categories/furniture/sala-v1.webp',
  SOFA: '/assets/categories/furniture/sala-v1.webp',
  COMEDOR: '/assets/categories/furniture/comedor-v1.webp',
  SILLA: '/assets/categories/furniture/silla-v1.webp',
  MESA: '/assets/categories/furniture/mesa-v1.webp',
  ALCOBA: '/assets/categories/furniture/alcoba-v1.webp',
  INFANTIL: '/assets/categories/furniture/infantil-v1.webp',
  OFICINA: '/assets/categories/furniture/oficina-v1.webp',
  COMPLEMENTO: '/assets/categories/furniture/complemento-v1.webp',
  OTRO: '/assets/categories/furniture/otro-v1.webp'
};

function numberFromInput(input) {
  const raw = String(input?.value || '').replace(/[^0-9]/g, '');
  return Number(raw || 0);
}
function categoryLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Mueble por definir';
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}
function decorateItem(card) {
  if (!card || card.dataset.mq5Ready === 'true') return;
  card.dataset.mq5Ready = 'true';
  const essential = card.querySelector('.quote-item-essential');
  if (!essential) return;

  const presentation = document.createElement('div');
  presentation.className = 'mq5-item-presentation';
  presentation.innerHTML = `
    <div class="mq5-item-thumb"><img alt="Referencia visual del mueble"></div>
    <div class="mq5-item-copy"><strong>Mueble por definir</strong><span>Completa modelo, medidas y acabados.</span><div class="mq5-item-swatches"></div></div>
    <div class="mq5-item-money"><span>Total</span><strong>$ 0</strong><button class="mq5-item-toggle" type="button">Contraer</button></div>`;
  essential.insertAdjacentElement('beforebegin', presentation);

  const description = card.querySelector('[data-field="description"]');
  const quantity = card.querySelector('[data-field="quantity"]');
  const unitValue = card.querySelector('[data-field="unitValue"]');
  const category = card.querySelector('[data-field="category"]');
  const fabric = card.querySelector('[data-field="fabric"]');
  const wood = card.querySelector('[data-field="wood"]');
  const specs = card.querySelector('[data-field="specifications"]');
  const lineTotal = card.querySelector('[data-line-total]');
  const toggle = presentation.querySelector('.mq5-item-toggle');

  function refresh() {
    const categoryValue = String(category?.value || '').toUpperCase();
    presentation.querySelector('.mq5-item-thumb img').src = CATEGORY_IMAGE[categoryValue] || '/assets/categories/furniture/sala-v1.webp';
    presentation.querySelector('.mq5-item-copy strong').textContent = String(description?.value || '').trim() || categoryLabel(categoryValue);
    const details = [];
    if (Number(quantity?.value || 0) > 1) details.push(`${quantity.value} unidades`);
    if (String(specs?.value || '').trim()) details.push(String(specs.value).trim().split('\n')[0]);
    else if (categoryValue) details.push(categoryLabel(categoryValue));
    presentation.querySelector('.mq5-item-copy > span').textContent = details.join(' · ') || 'Completa modelo, medidas y acabados.';

    const swatches = [];
    if (String(fabric?.value || '').trim()) swatches.push(`<span class="mq5-swatch">${escapeText(fabric.value)}</span>`);
    if (String(wood?.value || '').trim()) swatches.push(`<span class="mq5-swatch is-wood">${escapeText(wood.value)}</span>`);
    presentation.querySelector('.mq5-item-swatches').innerHTML = swatches.join('');

    const totalText = lineTotal?.textContent?.trim() || money.format(numberFromInput(unitValue) * Math.max(1, Number(quantity?.value || 1)));
    presentation.querySelector('.mq5-item-money strong').textContent = totalText;
    const ready = Boolean(String(description?.value || '').trim() && numberFromInput(unitValue));
    toggle.hidden = !ready;
    toggle.textContent = card.classList.contains('mq5-compact') ? 'Editar' : 'Contraer';
  }

  toggle.addEventListener('click', () => {
    card.classList.toggle('mq5-compact');
    refresh();
    if (!card.classList.contains('mq5-compact')) description?.focus({ preventScroll: true });
  });
  card.addEventListener('input', refresh);
  card.addEventListener('change', refresh);
  if (lineTotal) new MutationObserver(refresh).observe(lineTotal, { childList: true, characterData: true, subtree: true });
  refresh();
}
function escapeText(text) {
  return String(text ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

const itemRoot = document.getElementById('quote-items');
if (itemRoot) {
  itemRoot.querySelectorAll('.quote-item').forEach(decorateItem);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches('.quote-item')) decorateItem(node);
      node.querySelectorAll?.('.quote-item').forEach(decorateItem);
    }));
  }).observe(itemRoot, { childList: true, subtree: false });
}

/* Reset edit lock when a client lookup fills the whole record asynchronously. */
const clientMutation = new MutationObserver(() => {
  if (clientRequiredComplete()) clientEditLocked = false;
  refreshClientObject();
});
clientGrid?.querySelectorAll('input').forEach(input => clientMutation.observe(input, { attributes: true, attributeFilter: ['value'] }));

window.setTimeout(() => {
  refreshClientObject();
  itemRoot?.querySelectorAll('.quote-item').forEach(decorateItem);
}, 120);
