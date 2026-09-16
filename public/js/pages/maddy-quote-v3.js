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
mobile.addEventListener?.('change', syncMode);

syncMode();
