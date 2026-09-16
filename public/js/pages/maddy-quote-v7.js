const v7Style = document.createElement('link');
v7Style.rel = 'stylesheet';
v7Style.href = '/css/maddy-quote-v7.css?v=2';
document.head.appendChild(v7Style);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const itemRoot = document.getElementById('quote-items');
const itemsSection = document.querySelector('.quote-items-section');
const clientSection = document.querySelector('.quote-editor > .quote-editor-section');
const clientSummary = document.querySelector('.mq5-client-summary');
const clientMessage = document.getElementById('quote-client-message');
const reviewCta = document.querySelector('.mq6-review-cta');
const mobileReview = document.getElementById('mq-dock-review');
const flowButtons = [...document.querySelectorAll('.mq-flow-step')];

/* Language: concise and domain-specific. */
const itemsTitle = itemsSection?.querySelector('.quote-section-title h2');
const itemsHint = itemsSection?.querySelector('.quote-section-title small');
if (itemsTitle) itemsTitle.textContent = 'Muebles';
if (itemsHint) itemsHint.textContent = 'Agrega, revisa o edita las piezas de esta propuesta.';
if (flowButtons[2]) flowButtons[2].textContent = 'Revisar';
if (clientSummary) {
  clientSummary.setAttribute('role', 'group');
  clientSummary.setAttribute('aria-label', 'Cliente de la cotización');
}

function text(input) {
  return String(input?.value || '').trim();
}
function moneyValue(input) {
  return Number(String(input?.value || '').replace(/[^0-9]/g, '') || 0);
}
function hasCustomization(card) {
  return ['category','fabric','wood','specifications'].some(field => text(card.querySelector(`[data-field="${field}"]`)))
    || Boolean(card.querySelector('[data-photo-list] img'));
}
function stateFor(card) {
  const description = text(card.querySelector('[data-field="description"]'));
  const price = moneyValue(card.querySelector('[data-field="unitValue"]'));
  if (!description && !price && !hasCustomization(card)) return 'empty';
  if (description && price > 0) return 'ready';
  return 'working';
}
function stateLabel(state) {
  if (state === 'ready') return 'Listo';
  if (state === 'working') return 'En edición';
  return 'Nuevo';
}

/* Client lookup is progressive disclosure: document first, full record only when needed. */
function syncClientDisclosure() {
  if (!clientSection || !document.querySelector('.quote-field-grid-client')) return;
  if (clientSection.classList.contains('mq5-client-collapsed')) {
    clientSection.classList.remove('mq7-client-lookup-only');
    return;
  }
  const otherValues = [
    'quote-client-name','quote-client-phone','quote-client-alternatePhone',
    'quote-client-email','quote-client-address','quote-client-city'
  ].some(id => text(document.getElementById(id)));
  const message = String(clientMessage?.textContent || '').trim();
  const noMatch = /sin coincidencias|no encontramos|cliente nuevo|nuevo cliente/i.test(message);
  clientSection.classList.toggle('mq7-client-lookup-only', !otherValues && !noMatch);
}

function animateState(card) {
  if (reduceMotion.matches || typeof card.animate !== 'function') return;
  card.animate([
    { opacity: .84, transform: 'scale(.996)' },
    { opacity: 1, transform: 'none' }
  ], { duration: 170, easing: 'cubic-bezier(.2,.75,.25,1)' });
}

function syncCoverPhoto(card) {
  const photos = [...card.querySelectorAll('[data-photo-list] .quote-photo-thumb')];
  photos.forEach((photo, index) => photo.classList.toggle('mq7-cover-photo', index === 0));
}

function syncCard(card, { animate = false } = {}) {
  if (!card) return;
  const previous = card.dataset.mq7State || '';
  const next = stateFor(card);
  card.dataset.mq7State = next;
  card.classList.toggle('mq7-state-empty', next === 'empty');
  card.classList.toggle('mq7-state-working', next === 'working');
  card.classList.toggle('mq7-state-ready', next === 'ready');

  const head = card.querySelector('.quote-item-head');
  let state = head?.querySelector('.mq7-item-state');
  if (head && !state) {
    state = document.createElement('span');
    state.className = 'mq7-item-state';
    head.querySelector('[data-remove-item]')?.insertAdjacentElement('beforebegin', state);
  }
  if (state) state.textContent = stateLabel(next);

  const presentation = card.querySelector('.mq5-item-presentation');
  const compact = card.classList.contains('mq5-compact');
  if (presentation) {
    if (compact) {
      presentation.setAttribute('role', 'button');
      presentation.setAttribute('tabindex', '0');
      presentation.setAttribute('aria-label', `Editar ${text(card.querySelector('[data-field="description"]')) || 'mueble'}`);
    } else {
      presentation.removeAttribute('role');
      presentation.removeAttribute('tabindex');
      presentation.removeAttribute('aria-label');
    }
  }

  syncCoverPhoto(card);
  if (animate && previous && previous !== next) animateState(card);
}

function syncPageState() {
  const cards = [...(itemRoot?.querySelectorAll('.quote-item') || [])];
  const states = cards.map(stateFor);
  const clientCompact = Boolean(clientSection?.classList.contains('mq5-client-collapsed'));
  const readyCount = states.filter(state => state === 'ready').length;
  const anyStarted = states.some(state => state !== 'empty') || clientCompact;
  const allReady = cards.length > 0 && readyCount === cards.length && clientCompact;

  document.body.classList.toggle('mq7-empty-quote', !anyStarted);
  document.body.classList.toggle('mq7-working-quote', anyStarted && !allReady);
  document.body.classList.toggle('mq7-ready-quote', allReady);

  if (reviewCta) {
    reviewCta.disabled = readyCount === 0;
    const label = reviewCta.querySelector('span');
    if (label) label.textContent = readyCount === 0 ? 'Completa un mueble' : 'Revisar cotización';
  }
  if (mobileReview) {
    mobileReview.disabled = readyCount === 0;
    mobileReview.setAttribute('aria-disabled', String(readyCount === 0));
  }
}

function bindCard(card) {
  if (!card || card.dataset.mq7Bound === 'true') return;
  card.dataset.mq7Bound = 'true';
  syncCard(card);

  card.addEventListener('input', () => {
    syncCard(card, { animate: true });
    syncPageState();
  });
  card.addEventListener('change', () => {
    syncCard(card, { animate: true });
    syncPageState();
  });

  const presentation = card.querySelector('.mq5-item-presentation');
  presentation?.addEventListener('keydown', event => {
    if (!card.classList.contains('mq5-compact')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    presentation.click();
  });

  const photoList = card.querySelector('[data-photo-list]');
  if (photoList) {
    new MutationObserver(() => {
      syncCard(card, { animate: true });
      syncPageState();
    }).observe(photoList, { childList: true, subtree: true });
  }

  new MutationObserver(() => {
    syncCard(card);
    syncPageState();
  }).observe(card, { attributes: true, attributeFilter: ['class'] });
}

itemRoot?.querySelectorAll('.quote-item').forEach(bindCard);
if (itemRoot) {
  new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.quote-item')) bindCard(node);
        node.querySelectorAll?.('.quote-item').forEach(bindCard);
      });
    }
    syncPageState();
  }).observe(itemRoot, { childList: true });
}

if (clientSection) {
  /* Class changes only refresh quote state; they never write another client class. */
  new MutationObserver(syncPageState).observe(clientSection, { attributes: true, attributeFilter: ['class'] });
  clientSection.addEventListener('input', () => {
    syncClientDisclosure();
    syncPageState();
  });
  clientSection.addEventListener('change', () => {
    syncClientDisclosure();
    syncPageState();
  });
}
if (clientMessage) {
  new MutationObserver(syncClientDisclosure).observe(clientMessage, { childList: true, characterData: true, subtree: true });
}

/* Keep product state aligned with the actual total/count without introducing new business rules. */
for (const node of [document.getElementById('quote-total'), document.getElementById('quote-item-count')]) {
  if (node) new MutationObserver(syncPageState).observe(node, { childList: true, characterData: true, subtree: true });
}

syncClientDisclosure();
syncPageState();

window.MaddyQuoteV7 = Object.freeze({
  refresh() {
    itemRoot?.querySelectorAll('.quote-item').forEach(card => syncCard(card));
    syncClientDisclosure();
    syncPageState();
  }
});
