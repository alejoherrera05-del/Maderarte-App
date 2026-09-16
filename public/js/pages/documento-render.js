import {renderPayroll} from './nomina-render.js';
import {renderWarranty} from './garantia-render.js';
import { renderAdjustment } from './ajuste-render.js?v=returns-1';
import { renderReceipt } from './recibo-render.js';
import { renderRemission } from './remision-render.js';
import { renderConfirmedOrder } from './cotizacion-document-polish.js?v=family-1';
let started = false;
async function consume() {
  const node = document.getElementById('maddy-document-data');
  if (started || !node || node.type !== 'application/json') return;
  started = true;
  const target = document.getElementById('quote-preview-content');
  try {
    const snapshot = JSON.parse(node.textContent);
    node.remove();
    const result = await (snapshot.documentKind === 'payroll' ? renderPayroll(snapshot,target) : snapshot.documentKind === 'warranty' ? renderWarranty(snapshot,target) : snapshot.documentKind === 'adjustment' ? renderAdjustment(snapshot, target) : snapshot.documentKind === 'remission' ? renderRemission(snapshot, target) : snapshot.documentKind === 'receipt' ? renderReceipt(snapshot, target) : renderConfirmedOrder(snapshot, target));
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

