const v6Style = document.createElement('link');
v6Style.rel = 'stylesheet';
v6Style.href = '/css/maddy-quote-v6.css?v=1';
document.head.appendChild(v6Style);

const form = document.getElementById('quote-form');
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

/* ---- Draft status belongs in the toolbar, not as a floating technical message. ---- */
let saveState = null;
if (headerInner && !headerInner.querySelector('.mq6-save-state')) {
  saveState = document.createElement('div');
  saveState.className = 'mq6-save-state';
  saveState.setAttribute('role', 'status');
  saveState.setAttribute('aria-live', 'polite');
  saveState.innerHTML = '<span class="mq6-save-dot" aria-hidden="true"></span><span class="mq6-save-copy">Borrador</span>';
  const previewButton = document.getElementById('quote-preview-button');
  previewButton?.insertAdjacentElement('beforebegin', saveState);
}

function syncSaveState() {
  if (!saveState) return;
  const raw = String(draftStatus?.querySelector('span')?.textContent || draftStatus?.textContent || '').trim();
  const copy = saveState.querySelector('.mq6-save-copy');
  if (!copy) return;
  if (!raw) {
    copy.textContent = 'Borrador';
    saveState.dataset.state = 'idle';
    return;
  }
  if (/guardado/i.test(raw)) {
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

/* ---- Client switches between edit mode and identity mode only after editing is finished. ---- */
function setClientCompact(compact) {
  if (!clientSection) return;
  clientSection.classList.toggle('mq5-client-collapsed', Boolean(compact));
  clientSection.classList.toggle('mq6-client-object', Boolean(compact));
}

function maybeCompactClient() {
  if (!clientGrid || !clientSection || !clientComplete()) return;
  if (clientGrid.contains(document.activeElement)) return;
  setClientCompact(true);
}

clientGrid?.addEventListener('focusin', () => setClientCompact(false));
clientGrid?.addEventListener('focusout', () => window.setTimeout(maybeCompactClient, 0));
clientGrid?.addEventListener('input', () => {
  if (clientGrid.contains(document.activeElement)) setClientCompact(false);
});
clientGrid?.addEventListener('change', () => {
  if (clientGrid.contains(document.activeElement)) setClientCompact(false);
});

const clientEdit = document.querySelector('.mq5-client-edit');
clientEdit?.addEventListener('click', () => setClientCompact(false));
window.setTimeout(maybeCompactClient, 180);

/* ---- Furniture becomes an object after the seller finishes editing it. ---- */
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

  presentation.classList.toggle('is-ready', itemReady(card));
  card.classList.toggle('mq6-item-ready', itemReady(card));
}

function maybeCompactItem(card) {
  if (!card || !itemReady(card)) return;
  if (card.contains(document.activeElement)) return;
  const details = card.querySelector('.quote-item-details');
  if (details?.open) return;
  card.classList.add('mq5-compact', 'mq6-object-mode');
  syncFurnitureObject(card);
}

function openItem(card) {
  card?.classList.remove('mq5-compact', 'mq6-object-mode');
  syncFurnitureObject(card);
}

function bindItem(card) {
  if (!card || card.dataset.mq6Ready === 'true') return;
  card.dataset.mq6Ready = 'true';
  syncFurnitureObject(card);

  card.addEventListener('focusin', () => openItem(card));
  card.addEventListener('focusout', () => window.setTimeout(() => maybeCompactItem(card), 0));
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

  const photoList = card.querySelector('[data-photo-list]');
  if (photoList) new MutationObserver(() => syncFurnitureObject(card)).observe(photoList, { childList: true, subtree: true });

  window.setTimeout(() => maybeCompactItem(card), 120);
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

/* ---- The financial inspector earns attention only at review time. ---- */
const summaryCard = document.querySelector('.quote-summary-card');
let reviewCta = null;
if (summaryCard && !summaryCard.querySelector('.mq6-review-cta')) {
  reviewCta = document.createElement('button');
  reviewCta.type = 'button';
  reviewCta.className = 'mq6-review-cta';
  reviewCta.innerHTML = '<span>Revisar cotización</span><span aria-hidden="true">→</span>';
  summaryCard.appendChild(reviewCta);
  reviewCta.addEventListener('click', () => flowSections[2]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function syncReviewMode() {
  const active = [...document.querySelectorAll('.mq-flow-step')].findIndex(button => button.classList.contains('is-active'));
  document.body.classList.toggle('mq6-review-mode', active === 2);
  document.body.classList.toggle('mq6-work-mode', active !== 2);
}
if (flowNav) new MutationObserver(syncReviewMode).observe(flowNav, { attributes: true, subtree: true, attributeFilter: ['class'] });
syncReviewMode();

/* Escape returns from compact object mode to editing only when necessary. */
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const card = document.activeElement?.closest?.('.quote-item');
  if (card && !card.classList.contains('mq5-compact')) maybeCompactItem(card);
});
