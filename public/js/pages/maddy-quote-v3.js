const v4Style = document.createElement('link');
v4Style.rel = 'stylesheet';
v4Style.href = '/css/maddy-quote-v4.css?v=1';
document.head.appendChild(v4Style);

/* Keep the entire editor comfortably readable across desktop and mobile. */
const readability = document.createElement('style');
readability.textContent = `.maddy-quote-v3 .quote-field>label{font-size:15px!important}.maddy-quote-v3 .quote-field input:not([type=file]),.maddy-quote-v3 .quote-field select,.maddy-quote-v3 .quote-field textarea{font-size:16px!important}`;
document.head.appendChild(readability);

const summary = document.getElementById('quote-summary-column');
const reviewButton = document.getElementById('mq-dock-review');
const summaryClose = document.getElementById('mq-summary-close');
const backdrop = document.getElementById('mq-summary-backdrop');
const dock = document.getElementById('mq-mobile-dock');
const dockTotal = document.getElementById('mq-dock-total');
const dockCount = document.getElementById('mq-dock-count');
const workspace = document.getElementById('quote-workspace');
const total = document.getElementById('quote-total');
const count = document.getElementById('quote-item-count');
const preview = document.getElementById('quote-summary-preview');
const header = document.querySelector('.quote-header');
const mobile = window.matchMedia('(max-width: 760px)');
let trigger = null;

function syncDock() {
  if (dockTotal && total) dockTotal.textContent = total.textContent || '$ 0';
  if (dockCount && count) dockCount.textContent = count.textContent || '1 mueble';
  if (dock && workspace) dock.hidden = !mobile.matches || workspace.hidden;
}

function setSummaryAccessibility(open) {
  if (!summary) return;
  if (!mobile.matches) {
    summary.inert = false;
    summary.removeAttribute('aria-hidden');
    return;
  }
  summary.inert = !open;
  summary.setAttribute('aria-hidden', String(!open));
}

function openSummary() {
  if (!summary || !mobile.matches) return;
  trigger = document.activeElement;
  summary.classList.add('is-open');
  backdrop?.removeAttribute('hidden');
  requestAnimationFrame(() => backdrop?.classList.add('is-open'));
  document.body.classList.add('mq-summary-open');
  setSummaryAccessibility(true);
  window.setTimeout(() => summaryClose?.focus({ preventScroll: true }), 40);
}

function closeSummary({ restoreFocus = true } = {}) {
  if (!summary) return;
  summary.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  document.body.classList.remove('mq-summary-open');
  setSummaryAccessibility(false);
  window.setTimeout(() => backdrop?.setAttribute('hidden', ''), 190);
  if (restoreFocus && trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
}

function syncMode() {
  if (!mobile.matches) {
    summary?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    backdrop?.setAttribute('hidden', '');
    document.body.classList.remove('mq-summary-open');
  }
  setSummaryAccessibility(false);
  syncDock();
}

/* V4: a lightweight, scroll-aware work flow rather than a long HTML form. */
const editorSections = [...document.querySelectorAll('.quote-editor > .quote-editor-section')];
const flowLabels = ['Cliente', 'Muebles', 'Cierre'];
const flowNav = document.createElement('nav');
flowNav.className = 'mq-flow-steps';
flowNav.setAttribute('aria-label', 'Etapas de la cotización');

const flowButtons = editorSections.slice(0, 3).map((section, index) => {
  section.id ||= `mq-flow-section-${index + 1}`;
  section.style.scrollMarginTop = mobile.matches ? '112px' : '142px';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `mq-flow-step${index === 0 ? ' is-active' : ''}`;
  button.textContent = flowLabels[index];
  button.dataset.flowIndex = String(index);
  button.addEventListener('click', () => section.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  flowNav.appendChild(button);
  return button;
});

document.querySelector('.quote-document-head')?.insertAdjacentElement('afterend', flowNav);

function clientComplete() {
  return ['quote-client-document','quote-client-name','quote-client-phone','quote-client-email','quote-client-address','quote-client-city']
    .every(id => String(document.getElementById(id)?.value || '').trim());
}
function furnitureComplete() {
  const card = document.querySelector('.quote-item');
  return Boolean(String(card?.querySelector('[data-field="description"]')?.value || '').trim() && String(card?.querySelector('[data-field="unitValue"]')?.value || '').trim());
}
function refreshFlowCompletion() {
  flowButtons[0]?.classList.toggle('is-complete', Boolean(clientComplete()));
  flowButtons[1]?.classList.toggle('is-complete', Boolean(furnitureComplete()));
  flowButtons[2]?.classList.toggle('is-complete', Boolean(String(document.getElementById('quote-notes')?.value || '').trim()));
}

document.getElementById('quote-form')?.addEventListener('input', refreshFlowCompletion);
document.getElementById('quote-form')?.addEventListener('change', refreshFlowCompletion);

if ('IntersectionObserver' in window && editorSections.length) {
  const flowObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = editorSections.indexOf(visible.target);
    flowButtons.forEach((button, i) => button.classList.toggle('is-active', i === index));
  }, { rootMargin: '-18% 0px -64% 0px', threshold: [0, .1, .35, .6] });
  editorSections.slice(0, 3).forEach(section => flowObserver.observe(section));
}

function syncHeaderDepth() {
  header?.classList.toggle('mq4-scrolled', window.scrollY > 10);
}
window.addEventListener('scroll', syncHeaderDepth, { passive: true });
syncHeaderDepth();
refreshFlowCompletion();

reviewButton?.addEventListener('click', openSummary);
summaryClose?.addEventListener('click', () => closeSummary());
backdrop?.addEventListener('click', () => closeSummary());
preview?.addEventListener('click', () => {
  if (mobile.matches) closeSummary({ restoreFocus: false });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && summary?.classList.contains('is-open')) closeSummary();
});

const mirrorObserver = new MutationObserver(syncDock);
if (total) mirrorObserver.observe(total, { childList: true, characterData: true, subtree: true });
if (count) mirrorObserver.observe(count, { childList: true, characterData: true, subtree: true });
if (workspace) mirrorObserver.observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
mobile.addEventListener?.('change', () => {
  editorSections.forEach(section => { section.style.scrollMarginTop = mobile.matches ? '112px' : '142px'; });
  syncMode();
});

syncMode();
