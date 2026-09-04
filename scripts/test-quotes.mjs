import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const html = read('public/cotizacion.html');
const js = read('public/js/pages/cotizacion.js');
const documentJs = read('public/js/pages/cotizacion-document-polish.js');
const documentCss = read('public/css/cotizacion-document-premium.css');
const refinementCss = read('public/css/cotizacion-document-refinement.css');
const maddyAsset = read('public/assets/brand/maddy-by-maderarte.svg');
const companyProfile = read('public/js/core/company-profile.js');
const quotes = read('apps-script/Quotes.gs');
const router = read('apps-script/Router.gs');

assert.match(html, /id="quote-branch-gate"/);
assert.match(html, /id="quote-workspace" hidden/);
assert.match(html, /id="quote-meta-number"/);
assert.match(html, /id="quote-meta-date"/);
assert.match(html, /id="quote-meta-advisor"/);
assert.match(html, /cotizacion-document-premium\.css/);
assert.match(html, /cotizacion-document-polish\.js/);

assert.match(js, /apiRequest\('COTIZACION_META'/);
assert.match(router, /case 'COTIZACION_META': return quoteMeta_/);
assert.match(quotes, /requirePermission_\(session, 'cotizaciones\.read'\)/);
assert.match(quotes, /Siguiente_Cotizacion/);
assert.match(quotes, /Prefijo_Cotizacion/);

for (const field of ['description', 'category', 'quantity', 'fabric', 'wood', 'specifications', 'unitValue']) {
  assert.match(js, new RegExp(`data-field="${field}"`));
}
assert.doesNotMatch(js, /data-field="reference"/);
assert.doesNotMatch(js, /data-field="unit"/);
assert.doesNotMatch(js, /data-field="measures"/);

assert.match(companyProfile, /GRUPO EMPRESARIAL MADERARTE WILLRES SAS/);
assert.match(companyProfile, /901188291-2/);
assert.match(companyProfile, /3006478590/);
assert.match(companyProfile, /3117476465/);
assert.match(companyProfile, /www\.maderartepopayan\.com/);
assert.match(companyProfile, /@maderartepopayan/);

assert.match(documentJs, /if \(!withPhotos\.length\) return '';/);
assert.match(documentJs, /client\.document \?/);
assert.match(documentJs, /data\.discount > 0 \?/);
assert.doesNotMatch(documentJs, /Sin especificaciones adicionales/);

assert.match(documentJs, /quote-brand-header/);
assert.match(documentJs, /quote-brand-band/);
assert.match(documentJs, /quote-doc-meta/);
assert.match(documentJs, /quote-document-title/);
assert.match(documentJs, /COTIZACIÓN N°/);
assert.match(documentJs, />FECHA</);
assert.match(documentJs, />SEDE</);
assert.match(documentJs, /<strong>COTIZACIÓN<\/strong>/);
assert.match(documentJs, /quote-client-heading/);
assert.match(documentJs, /quote-preview-item-index/);
assert.match(documentJs, /quote-order-conditions/);
assert.match(documentJs, /quote-order-condition-deposit/);
assert.match(documentJs, /quote-order-condition-time/);
assert.match(documentJs, /quote-maddy-footer/);
assert.match(documentJs, /maddy-by-maderarte\.svg/);
assert.match(documentJs, /Sistema Maddy v/);
assert.match(documentJs, /signatureMarkup\(data\.advisor\)/);
assert.doesNotMatch(documentJs, /Asesor:/);
assert.doesNotMatch(documentJs, /quote-preview-terms/);
assert.doesNotMatch(documentJs, /quote-preview-footer/);

assert.match(documentCss, /\.quote-brand-band/);
assert.match(documentCss, /background:\s*#292724/);
assert.doesNotMatch(documentCss, /gradient\(/);
assert.match(documentCss, /\.quote-doc-meta/);
assert.match(documentCss, /border-radius:\s*12px/);
assert.match(documentCss, /\.quote-document-title strong/);
assert.match(documentCss, /\.quote-client-section/);
assert.match(documentCss, /\.quote-preview-item-index/);
assert.match(documentCss, /\.quote-document-signature/);

assert.match(refinementCss, /\.quote-order-conditions/);
assert.match(refinementCss, /\.quote-order-condition-value/);
assert.match(refinementCss, /\.quote-maddy-footer/);
assert.match(refinementCss, /\.quote-maddy-footer-art/);
assert.match(refinementCss, /\.quote-print-export/);
assert.match(maddyAsset, /Maddy by Maderarte/);
assert.match(maddyAsset, /<path/);

console.log('OK · cotización Maderarte protegida');
console.log('OK · cabecera sólida con número, fecha y sede protegida');
console.log('OK · cliente e items con jerarquía editorial');
console.log('OK · condiciones del pedido especializadas');
console.log('OK · firma del asesor + pie documental Maddy protegidos');
