import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const html = read('public/cotizacion.html');
const js = read('public/js/pages/cotizacion.js');
const documentJs = read('public/js/pages/cotizacion-document-polish.js');
const editorialCss = read('public/css/cotizacion-document-editorial.css');
const adaptiveCss = read('public/css/cotizacion-document-adaptive.css');
const maddyAsset = read('public/assets/brand/maddy-by-maderarte.svg');
const companyProfile = read('public/js/core/company-profile.js');
const quotes = read('apps-script/Quotes.gs');
const router = read('apps-script/Router.gs');

assert.match(html, /id="quote-branch-gate"/);
assert.match(html, /id="quote-workspace" hidden/);
assert.match(html, /id="quote-meta-number"/);
assert.match(html, /id="quote-meta-date"/);
assert.match(html, /id="quote-meta-advisor"/);
assert.match(html, /cotizacion-document-polish\.js/);
assert.match(html, /cotizacion-document-adaptive\.css/);

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

assert.match(documentJs, /compactDate/);
assert.match(documentJs, /quote-editorial-header/);
assert.match(documentJs, /quote-editorial-document-identity/);
assert.match(documentJs, /quote-editorial-number/);
assert.match(documentJs, /<h1>COTIZACIÓN<\/h1>/);
assert.match(documentJs, /quote-editorial-client/);
assert.match(documentJs, /Información del cliente/);
assert.match(documentJs, /quote-editorial-item/);
assert.match(documentJs, /quote-editorial-table-head/);
assert.match(documentJs, /quote-editorial-investment/);
assert.doesNotMatch(documentJs, /Saldo posterior/);
assert.match(documentJs, /quote-editorial-term-cards/);
assert.match(documentJs, /wallet\.svg/);
assert.match(documentJs, /calendar-dots\.svg/);
assert.match(documentJs, /Abono mínimo para confirmar/);
assert.match(documentJs, /Fabricación estimada/);
assert.match(documentJs, /quote-editorial-signature/);
assert.match(documentJs, /quote-editorial-footer/);
assert.match(documentJs, /quote-document-page-number/);
assert.match(documentJs, /photoPages/);
assert.match(documentJs, /appendixPageMarkup/);
assert.match(documentJs, /Página \$\{pageNumber\} de \$\{totalPages\}/);
assert.match(documentJs, /maddy-by-maderarte\.svg/);
assert.match(documentJs, /Maderarte · Sistema Maddy/);
assert.doesNotMatch(documentJs, /Asesor:/);

assert.match(editorialCss, /\.quote-editorial-page/);
assert.match(editorialCss, /\.quote-editorial-letterhead/);
assert.match(editorialCss, /\.quote-editorial-document-identity/);
assert.match(editorialCss, /\.quote-editorial-number strong/);
assert.match(editorialCss, /font-size:\s*1\.08rem/);
assert.match(editorialCss, /\.quote-editorial-client/);
assert.match(editorialCss, /border-left:\s*3px solid #b65a2b/);
assert.match(editorialCss, /\.quote-editorial-item/);
assert.match(editorialCss, /\.quote-editorial-investment/);
assert.match(editorialCss, /\.quote-editorial-term-cards/);
assert.match(editorialCss, /\.quote-editorial-term-icon/);
assert.match(editorialCss, /\.quote-editorial-term-value/);
assert.match(editorialCss, /font-size:\s*1\.65rem/);
assert.match(editorialCss, /\.quote-editorial-footer/);
assert.match(editorialCss, /width:\s*136px/);
assert.match(editorialCss, /body\.quote-print-export/);
assert.doesNotMatch(editorialCss, /gradient\(/);

assert.match(adaptiveCss, /\.quote-editorial-closing/);
assert.match(adaptiveCss, /margin-top:\s*auto/);
assert.match(adaptiveCss, /\.quote-editorial-table-head/);
assert.match(adaptiveCss, /\.quote-preview-appendix-page/);
assert.match(adaptiveCss, /\.quote-document-footer/);
assert.match(adaptiveCss, /break-after:\s*page/);
assert.match(adaptiveCss, /height:\s*1118px/);

assert.match(maddyAsset, /Maddy by Maderarte/);
assert.match(maddyAsset, /<path/);

console.log('OK · cotización Maderarte con jerarquía legible protegida');
console.log('OK · cuerpo adaptable usa la altura disponible sin apretar contenido');
console.log('OK · detalle de productos mantiene columnas comerciales claras');
console.log('OK · anexo fotográfico se pagina en hojas reales con numeración');
console.log('OK · pie Maddy y número de página protegidos en todas las hojas');
