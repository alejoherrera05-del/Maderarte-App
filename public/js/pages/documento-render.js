import { renderConfirmedOrder } from './cotizacion-document-polish.js?v=documents-1';
let started = false;
async function consume() {
  const node = document.getElementById('maddy-document-data');
  if (started || !node || node.type !== 'application/json') return;
  started = true;
  const target = document.getElementById('quote-preview-content');
  try {
    const snapshot = JSON.parse(node.textContent);
    node.remove();
    const result = await renderConfirmedOrder(snapshot, target);
    target.dataset.documentPages = String(result.pages);
    target.dataset.documentReady = 'true';
  } catch {
    target.replaceChildren();
    target.dataset.documentError = 'true';
    // No customer payload or internal diagnostics are written to browser logs.
  }
}
new MutationObserver(() => { void consume(); }).observe(document.documentElement, { childList: true, subtree: true });
void consume();
