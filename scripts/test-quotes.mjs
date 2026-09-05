import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { quoteContext, quoteReader } from './quote-test-context.mjs';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const html = read('public/cotizacion.html');
const js = read('public/js/pages/cotizacion.js');
const documentJs = read('public/js/pages/cotizacion-document-polish.js');
const editorialCss = read('public/css/cotizacion-document-editorial.css');
const adaptiveCss = read('public/css/cotizacion-document-adaptive.css');
const trackingHtml = read('public/cotizaciones.html');
const trackingJs = read('public/js/pages/cotizaciones.js');
const trackingCss = read('public/css/quote-tracking.css');
const trackingShellCss = read('public/css/quote-tracking-shell.css');
const moduleShellCss = read('public/css/module-shell.css');
const authJs = read('public/js/core/auth.js');
const maddyAsset = read('public/assets/brand/maddy-by-maderarte.svg');
const companyProfile = read('public/js/core/company-profile.js');
const quotes = read('apps-script/Quotes.gs');
const router = read('apps-script/Router.gs');

assert.match(html, /id="quote-branch-gate"/);
assert.match(html, /id="quote-workspace" hidden/);
assert.match(html, /id="quote-meta-number"/);
assert.match(html, /id="quote-meta-date"/);
assert.match(html, /id="quote-meta-advisor"/);
assert.match(js, /cotizacion-document-polish\.js/);
assert.match(html, /cotizacion-document-adaptive\.css/);

assert.match(js, /apiRequest\('COTIZACION_META'/);
assert.match(router, /case 'COTIZACION_META': return quoteMeta_/);
assert.match(quotes, /requirePermission_\(session, 'cotizaciones\.read'\)/);
assert.match(quotes, /Siguiente_Cotizacion/);
assert.match(quotes, /Prefijo_Cotizacion/);

// A configured prefix may already end in a separator. Reading metadata must
// produce the same number on every call without consuming the next sequence.
for (const [prefix, next, expected] of [
  ['MP-COT-', 1, 'MP-COT-0001'],
  ['MP-COT', 1, 'MP-COT-0001'],
  [' tp-cot- ', 27, 'TP-COT-0027'],
  ['MP-COT--', 42, 'MP-COT-0042'],
  ['MP-COT-', 10000, 'MP-COT-10000'],
  ['', 1, 'COT-0001'],
  ['   ', 1, 'COT-0001']
]) {
  const backend = quoteContext([]);
  const row = Object.freeze({ Sede_ID: 'MP', Estado: 'ACTIVA', Prefijo_Cotizacion: prefix, Siguiente_Cotizacion: next });
  backend.findRow_ = (sheet, header, branch) => {
    assert.deepEqual([sheet, header, branch], ['Sedes', 'Sede_ID', 'MP']);
    return row;
  };
  backend.getConfigValue_ = (_key, fallback) => fallback;
  const meta = backend.quoteMeta_({ branch: 'MP' }, quoteReader);
  assert.equal(meta.previewNumber, expected);
  assert.equal(meta.numberStatus, 'PREVISTO');
  assert.equal(backend.quoteMeta_({ branch: 'MP' }, quoteReader).previewNumber, expected);
  assert.equal(row.Siguiente_Cotizacion, next);
}

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
assert.match(documentJs, /COMMERCIAL_DOCUMENT.title/);
assert.match(read('public/js/core/commercial-document.js'), /'ORDEN DE PEDIDO' : 'COTIZACIÓN'/);
assert.match(documentJs, /quote-editorial-client/);
assert.match(documentJs, /Información del cliente/);
assert.match(documentJs, /quote-editorial-item/);
assert.match(documentJs, /quote-editorial-table-head/);
assert.match(documentJs, /quote-editorial-investment/);
assert.doesNotMatch(documentJs, /Saldo posterior/);
assert.match(documentJs, /quote-editorial-term-cards/);
assert.doesNotMatch(documentJs, /minimumOrderDeposit|Abono mínimo/);
assert.match(documentJs, /calendar-dots\.svg/);
assert.match(documentJs, /Segundo teléfono/);
assert.match(documentJs, /Si requiere fabricación/);
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

assert.match(trackingHtml, /id="tracking-app"/);
assert.match(trackingHtml, /module-shell\.css/);
assert.match(trackingHtml, /quote-tracking-shell\.css/);
assert.match(trackingHtml, /cotizaciones\.js/);
assert.match(trackingJs, /COTIZACIONES_LISTAR/);
assert.match(trackingJs, /permission:\s*'cotizaciones\.read'/);
assert.match(trackingJs, /0–7 días/);
assert.match(trackingJs, /8–15 días/);
assert.match(trackingJs, /\+15 días/);
assert.match(trackingJs, /tracking-radar-recent-count/);
assert.match(trackingJs, /tracking-radar-attention-count/);
assert.match(trackingJs, /tracking-radar-priority-count/);
assert.match(trackingJs, /APP_CONFIG\.version/);
assert.match(trackingJs, /module-brand-wordmark/);
assert.match(trackingJs, /module-footer-maddy/);
assert.match(trackingJs, /safeExternalUrl/);
assert.match(trackingJs, /Últimos 30 días/);
assert.match(trackingCss, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(trackingCss, /\.tracking-card\.age-recent::before/);
assert.match(trackingCss, /\.tracking-card\.age-attention::before/);
assert.match(trackingCss, /\.tracking-card\.age-priority::before/);
assert.match(trackingShellCss, /\.tracking-command/);
assert.match(trackingShellCss, /\.tracking-radar-grid/);
assert.match(trackingShellCss, /\.tracking-radar-segment/);
assert.match(moduleShellCss, /\.module-appbar-inner/);
assert.match(moduleShellCss, /\.module-brand-wordmark/);
assert.match(moduleShellCss, /\.module-footer-maddy/);
assert.match(moduleShellCss, /width:\s*158px/);
assert.match(authJs, /action === 'COTIZACIONES_LISTAR'/);
assert.match(router, /case 'COTIZACIONES_LISTAR': return listQuotes_/);
assert.match(quotes, /function listQuotes_/);
assert.match(quotes, /listRows_\('Cotizaciones'\)/);
assert.match(quotes, /requirePermission_\(session, 'cotizaciones\.read'\)/);

assert.match(maddyAsset, /Maddy by Maderarte/);
assert.match(maddyAsset, /<path/);

console.log('OK · cotización Maderarte con jerarquía legible protegida');
console.log('OK · cuerpo adaptable usa la altura disponible sin apretar contenido');
console.log('OK · detalle de productos mantiene columnas comerciales claras');
console.log('OK · anexo fotográfico se pagina en hojas reales con numeración');
console.log('OK · seguimiento usa cabecera de módulo reusable con radar funcional');
console.log('OK · Maddy y versión de app quedan visibles en el pie de sistema');
console.log('OK · API de seguimiento respeta permisos, sedes y base cero');
console.log('OK · consecutivo previsto acepta prefijos con o sin guion final sin consumir números');
console.log('OK · pie Maddy y número de página protegidos en todas las hojas');
