import { renderIssuedOrder } from './cotizacion-document-polish.js';
import { rasterizedDocumentPdf } from '../core/pdf-pages.js';
// Called only through the same-origin parent window, not a public message handler.
window.maddyRenderDocument = async (snapshot, photos = {}, receipt = '') => {
  const target = document.getElementById('quote-preview-content');
  await renderIssuedOrder(snapshot, photos, target, receipt);
  return rasterizedDocumentPdf(target);
};
