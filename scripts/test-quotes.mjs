import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const html = read('public/cotizacion.html');
const js = read('public/js/pages/cotizacion.js');
const documentJs = read('public/js/pages/cotizacion-document-polish.js');
const editorialCss = read('public/css/cotizacion-document-editorial.css');
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
assert.match(documentJs, /quote-editorial-header/);
assert.match(documentJs, /quote-editorial-letterhead/);
assert.match(documentJs, /quote-editorial-document/);
assert.match(documentJs, /<h1>COTIZACIÓN<\/h1>/);
assert.match(documentJs, /quote-editorial-client/);
assert.match(documentJs, /Preparado para/);
assert.match(documentJs, /quote-editorial-item/);
assert.match(documentJs, /quote-editorial-investment/);
assert.match(documentJs, /Anticipo para confirmar/);
assert.match(documentJs, /quote-editorial-terms/);
assert.match(documentJs, /Confirmación del pedido/);
assert.match(documentJs, /25–30 días/);
assert.match(documentJs, /quote-editorial-signature/);
assert.match(documentJs, /quote-editorial-footer/);
assert.match(documentJs, /maddy-by-maderarte\.svg/);
assert.match(documentJs, /Sistema Maddy v/);
assert.doesNotMatch(documentJs, /quote-brand-band/);
assert.doesNotMatch(documentJs, /quote-order-conditions/);
assert.doesNotMatch(documentJs, /quote-maddy-footer/);
assert.doesNotMatch(documentJs, /Asesor:/);

assert.match(editorialCss, /\.quote-editorial-page/);
assert.match(editorialCss, /\.quote-editorial-letterhead/);
assert.match(editorialCss, /grid-template-columns:\s*minmax\(0, \.84fr\)/);
assert.match(editorialCss, /font-family:\s*"Iowan Old Style"/);
assert.match(editorialCss, /\.quote-editorial-client/);
assert.match(editorialCss, /border-left:\s*2px solid #b65a2b/);
assert.match(editorialCss, /\.quote-editorial-item/);
assert.match(editorialCss, /\.quote-editorial-investment/);
assert.match(editorialCss, /\.quote-editorial-term-row/);
assert.match(editorialCss, /\.quote-editorial-footer/);
assert.match(editorialCss, /body\.quote-print-export/);
assert.doesNotMatch(editorialCss, /gradient\(/);

assert.match(maddyAsset, /Maddy by Maderarte/);
assert.match(maddyAsset, /<path/);

console.log('OK · cotización editorial Maderarte protegida');
console.log('OK · membrete ejecutivo blanco y COTIZACIÓN dominante');
console.log('OK · cliente, items y resumen comercial sin cards genéricas');
console.log('OK · condiciones clave como filas editoriales');
console.log('OK · firma del asesor + pie documental Maddy protegidos');
