const v6Style = document.createElement('link');
v6Style.rel = 'stylesheet';
v6Style.href = '/css/maddy-quote-v6.css?v=3';
document.head.appendChild(v6Style);

const previewMode = new URLSearchParams(location.search).get('preview') === '1';
const clientSection = document.querySelector('.quote-editor > .quote-editor-section');
const clientGrid = document.querySelector('.quote-field-grid-client');
const itemRoot = document.getElementById('quote-items');
const draftStatus = document.getElementById('quote-draft-status');
const headerInner = document.querySelector('.quote-header-inner');
const flowNav = document.querySelector('.mq-flow-steps');
const flowSections = [...document.querySelectorAll('.quote-editor > .quote-editor-section')].slice(0, 3);

function value(id) {
  return String(document.getElementById(id)?.value || '').trim();
}
function clientComplete() {
  return ['quote-client-document','quote-client-name','quote-client-phone','quote-client-email','quote-client-address','quote-client-city']
    .every(id => value(id));
}

/* Draft status belongs in the toolbar, not as a permanent technical block. */
let saveState = null;
if (headerInner && !headerInner.querySelector('.mq6-save-state')) {
  saveState = document.createElement('div');
  saveState.className = 'mq6-save-state';
  saveState.setAttribute('role', 'status');
  saveState.setAttribute('aria-live', 'polite');
  saveState.innerHTML = '<span class="mq6-save-dot" aria-hidden="true"></span><span class="mq6-save-copy">Borrador</span>';
  document.getElementById('quote-preview-button')?.insertAdjacentElement('beforebegin', saveState);
}
function syncSaveState() {
  if (!saveState) return;
  const raw = String(draftStatus?.querySelector('span')?.textContent || draftStatus?.textContent || '').trim();
  const copy = saveState.querySelector('.mq6-save-copy');
  if (!copy) return;
  if (!raw) {
    copy.textContent = 'Borrador';
    saveState.dataset.state = 'idle';
  } else if (/guardado/i.test(raw)) {
    copy.textContent = raw.replace('Guardado en este dispositivo · ', 'Guardado · ');
    saveState.dataset.state = 'saved';
  } else if (/recuperamos/i.test(raw)) {
    copy.textContent = 'Borrador recuperado';
    saveState.dataset.state = 'restored';
  } else if (/no se han guardado|no pudimos/i.test(raw)) {
    copy.textContent = 'Cambios pendientes';
    saveState.dataset.state = 'warning';
  } else {
    copy.textContent = 'Borrador';
    saveState.dataset.state = 'idle';
  }
}
if (draftStatus) new MutationObserver(syncSaveState).observe(draftStatus, { childList: true, characterData: true, subtree: true });
syncSaveState();

/* Client becomes identity only after the seller leaves a complete client block. */
function setClientCompact(compact) {
  if (!clientSection) return;
  clientSection.classList.toggle('mq5-client-collapsed', Boolean(compact));
  clientSection.classList.toggle('mq6-client-object', Boolean(compact));
}
function maybeCompactClient() {
  if (!clientGrid || !clientComplete()) return;
  if (clientGrid.contains(document.activeElement)) return;
  setClientCompact(true);
}
if (!previewMode) {
  clientGrid?.addEventListener('focusin', () => setClientCompact(false));
  clientGrid?.addEventListener('focusout', () => window.setTimeout(maybeCompactClient, 0));
  clientGrid?.addEventListener('input', () => {
    if (clientGrid.contains(document.activeElement)) setClientCompact(false);
  });
  clientGrid?.addEventListener('change', () => {
    if (clientGrid.contains(document.activeElement)) setClientCompact(false);
  });
  window.setTimeout(maybeCompactClient, 180);
}
document.querySelector('.mq5-client-edit')?.addEventListener('click', () => setClientCompact(false));

/* Furniture becomes an object only at explicit, safe workflow boundaries. */
function moneyInputValue(input) {
  return Number(String(input?.value || '').replace(/[^0-9]/g, '') || 0);
}
function itemReady(card) {
  const description = String(card?.querySelector('[data-field="description"]')?.value || '').trim();
  const price = moneyInputValue(card?.querySelector('[data-field="unitValue"]'));
  return Boolean(description && price > 0);
}
function firstReferencePhoto(card) {
  return card?.querySelector('[data-photo-list] img')?.getAttribute('src') || '';
}
function syncFurnitureObject(card) {
  if (!card) return;
  const presentation = card.querySelector('.mq5-item-presentation');
  const thumb = presentation?.querySelector('.mq5-item-thumb');
  const img = thumb?.querySelector('img');
  if (!presentation || !thumb || !img) return;

  let empty = thumb.querySelector('.mq6-thumb-empty');
  if (!empty) {
    empty = document.createElement('span');
    empty.className = 'mq6-thumb-empty';
    empty.innerHTML = '<strong>Referencia</strong><span>Añade una foto o elige categoría</span>';
    thumb.appendChild(empty);
  }

  const category = String(card.querySelector('[data-field="category"]')?.value || '').trim();
  const userPhoto = firstReferencePhoto(card);
  if (userPhoto) {
    img.src = userPhoto;
    thumb.dataset.source = 'photo';
    empty.hidden = true;
  } else if (category) {
    thumb.dataset.source = 'category';
    empty.hidden = true;
  } else {
    thumb.dataset.source = 'empty';
    empty.hidden = false;
  }

  let quantity = presentation.querySelector('.mq6-item-quantity');
  if (!quantity) {
    quantity = document.createElement('span');
    quantity.className = 'mq6-item-quantity';
    presentation.querySelector('.mq5-item-money')?.insertAdjacentElement('afterbegin', quantity);
  }
  const qty = Math.max(1, Number(card.querySelector('[data-field="quantity"]')?.value || 1));
  quantity.textContent = qty === 1 ? '1 unidad' : `${qty} unidades`;

  const ready = itemReady(card);
  presentation.classList.toggle('is-ready', ready);
  card.classList.toggle('mq6-item-ready', ready);
}
function compactItem(card) {
  if (!card || !itemReady(card)) return;
  const details = card.querySelector('.quote-item-details');
  if (details?.open) return;
  card.classList.add('mq5-compact', 'mq6-object-mode');
  syncFurnitureObject(card);
}
function openItem(card) {
  card?.classList.remove('mq5-compact', 'mq6-object-mode');
  syncFurnitureObject(card);
}
function compactReadyItems(except = null) {
  itemRoot?.querySelectorAll('.quote-item').forEach(card => {
    if (card !== except) compactItem(card);
  });
}

function bindItem(card) {
  if (!card || card.dataset.mq6Ready === 'true') return;
  card.dataset.mq6Ready = 'true';
  syncFurnitureObject(card);

  card.addEventListener('input', () => syncFurnitureObject(card));
  card.addEventListener('change', () => syncFurnitureObject(card));

  const presentation = card.querySelector('.mq5-item-presentation');
  presentation?.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    if (card.classList.contains('mq5-compact')) {
      openItem(card);
      window.setTimeout(() => card.querySelector('[data-field="description"]')?.focus({ preventScroll: true }), 0);
    }
  });

  const existingToggle = card.querySelector('.mq5-item-toggle');
  if (existingToggle) {
    existingToggle.textContent = 'Editar';
    existingToggle.addEventListener('click', event => {
      event.stopPropagation();
      openItem(card);
    });
  }

  const details = card.querySelector('.quote-item-details');
  if (!previewMode) {
    details?.addEventListener('toggle', () => {
      if (!details.open) window.setTimeout(() => compactItem(card), 0);
    });
  }

  const photoList = card.querySelector('[data-photo-list]');
  if (photoList) new MutationObserver(() => syncFurnitureObject(card)).observe(photoList, { childList: true, subtree: true });

  if (!previewMode) window.setTimeout(() => compactItem(card), 160);
}

itemRoot?.querySelectorAll('.quote-item').forEach(bindItem);
if (itemRoot) {
  new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.quote-item')) bindItem(node);
        node.querySelectorAll?.('.quote-item').forEach(bindItem);
      });
    }
  }).observe(itemRoot, { childList: true, subtree: false });
}

if (!previewMode) {
  document.getElementById('quote-add-item')?.addEventListener('click', () => {
    const cards = [...(itemRoot?.querySelectorAll('.quote-item') || [])];
    compactReadyItems(cards.at(-1) || null);
  });
  flowNav?.addEventListener('click', () => window.setTimeout(() => compactReadyItems(), 0));
}

/* Financial inspector earns attention only at review time. */
const summaryCard = document.querySelector('.quote-summary-card');
let reviewCta = null;
if (summaryCard && !summaryCard.querySelector('.mq6-review-cta')) {
  reviewCta = document.createElement('button');
  reviewCta.type = 'button';
  reviewCta.className = 'mq6-review-cta';
  reviewCta.innerHTML = '<span>Revisar cotización</span><span aria-hidden="true">→</span>';
  summaryCard.appendChild(reviewCta);
  reviewCta.addEventListener('click', () => {
    compactReadyItems();
    flowSections[2]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
function syncReviewMode() {
  const active = [...document.querySelectorAll('.mq-flow-step')].findIndex(button => button.classList.contains('is-active'));
  document.body.classList.toggle('mq6-review-mode', active === 2);
  document.body.classList.toggle('mq6-work-mode', active !== 2);
}
if (flowNav) new MutationObserver(syncReviewMode).observe(flowNav, { attributes: true, subtree: true, attributeFilter: ['class'] });
syncReviewMode();

/* Explicit API lets QA capture the same finished-object state a real seller sees after leaving edit mode. */
window.MaddyQuoteV6 = Object.freeze({
  compactClient() { if (clientComplete()) setClientCompact(true); },
  editClient() { setClientCompact(false); },
  compactItems() { compactReadyItems(); },
  editItems() { itemRoot?.querySelectorAll('.quote-item').forEach(openItem); },
  refresh() { itemRoot?.querySelectorAll('.quote-item').forEach(syncFurnitureObject); syncSaveState(); }
});
