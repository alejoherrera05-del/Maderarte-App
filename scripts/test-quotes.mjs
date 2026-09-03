import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const html = read('public/cotizacion.html');
const js = read('public/js/pages/cotizacion.js');
const css = read('public/css/cotizacion-form.css');
const polishCss = read('public/css/cotizacion-brand-polish.css');
const documentPolish = read('public/js/pages/cotizacion-document-polish.js');
const companyProfile = read('public/js/core/company-profile.js');
const quotes = read('apps-script/Quotes.gs');
const router = read('apps-script/Router.gs');

assert.match(html, /id="quote-branch-gate"/, 'La cotización debe comenzar por la selección de sede');
assert.match(html, /id="quote-workspace" hidden/, 'El formulario debe permanecer bloqueado hasta elegir sede');
assert.match(html, /id="quote-meta-number"/, 'Debe existir una ubicación visible para el consecutivo');
assert.match(html, /id="quote-meta-date"/, 'Debe existir una ubicación visible para la fecha');
assert.match(html, /id="quote-meta-advisor"/, 'Debe mostrarse el asesor de la cotización');
assert.match(html, /cotizacion-brand-polish\.css/, 'Debe cargarse la capa visual específica de Maderarte');
assert.match(html, /cotizacion-document-polish\.js/, 'Debe cargarse la vista previa documental limpia');

assert.match(js, /apiRequest\('COTIZACION_META'/, 'El formulario debe solicitar metadata real por sede');
assert.match(router, /case 'COTIZACION_META': return quoteMeta_/, 'Falta la ruta COTIZACION_META');
assert.match(quotes, /requirePermission_\(session, 'cotizaciones\.read'\)/, 'La metadata debe exigir cotizaciones.read');
assert.match(quotes, /Siguiente_Cotizacion/, 'El consecutivo previsto debe salir de la sede');
assert.match(quotes, /Prefijo_Cotizacion/, 'El consecutivo debe respetar el prefijo de la sede');
assert.match(quotes, /branchAddress/, 'La metadata debe exponer la dirección pública de la sede');
assert.match(quotes, /branchPhone/, 'La metadata debe exponer el teléfono público de la sede');

assert.match(js, /data-field="description"/, 'Cada mueble debe conservar descripción');
assert.match(js, /data-field="category"/, 'Cada mueble debe conservar categoría');
assert.match(js, /data-field="quantity"/, 'Cada mueble debe conservar cantidad');
assert.match(js, /data-field="fabric"/, 'Cada mueble debe conservar tela o acabado');
assert.match(js, /data-field="wood"/, 'Cada mueble debe conservar madera o acabado');
assert.match(js, /data-field="specifications"/, 'Cada mueble debe conservar especificaciones');
assert.match(js, /data-field="unitValue"/, 'Cada mueble debe conservar valor unitario');
assert.doesNotMatch(js, /data-field="reference"/, 'Referencia no debe reaparecer como campo separado');
assert.doesNotMatch(js, /data-field="unit"/, 'Unidad no debe reaparecer como campo editable');
assert.doesNotMatch(js, /data-field="measures"/, 'Medidas no debe reaparecer como campo separado');

assert.match(companyProfile, /GRUPO EMPRESARIAL MADERARTE WILLRES SAS/, 'Falta la razón social oficial');
assert.match(companyProfile, /901188291-2/, 'Falta el NIT oficial');
assert.match(companyProfile, /3006478590/, 'Falta el celular comercial');
assert.match(companyProfile, /3117476465/, 'Falta el WhatsApp comercial');
assert.match(companyProfile, /www\.maderartepopayan\.com/, 'Falta el sitio web oficial');
assert.match(companyProfile, /@maderartepopayan/, 'Falta el usuario oficial de redes');
assert.match(companyProfile, /Transversal 9 # 6N-26/, 'Falta la dirección de la sede principal');
assert.match(companyProfile, /Terraplaza · Local 113/, 'Falta la dirección de la sede norte');
assert.match(quotes, /GRUPO EMPRESARIAL MADERARTE WILLRES SAS/, 'Apps Script debe usar la razón social oficial como fallback');
assert.match(quotes, /901188291-2/, 'Apps Script debe usar el NIT oficial como fallback');

assert.match(documentPolish, /if \(!withPhotos\.length\) return '';/, 'No debe generarse anexo cuando no hay fotografías');
assert.match(documentPolish, /client\.document \?/, 'Los datos opcionales del cliente deben renderizarse condicionalmente');
assert.match(documentPolish, /data\.discount > 0 \?/, 'El descuento en cero no debe imprimirse como una fila vacía');
assert.doesNotMatch(documentPolish, /Sin especificaciones adicionales/, 'El PDF no debe imprimir placeholders por datos faltantes');
assert.match(documentPolish, /quote-preview-letterhead/, 'La vista previa debe conservar membrete específico');

assert.match(css, /\.quote-gate-stage/, 'Falta el sistema visual del selector de sede');
assert.match(css, /\.quote-preview-letterhead/, 'Falta el sistema visual premium del membrete');
assert.match(polishCss, /\.quote-preview-button[\s\S]*background:\s*var\(--quote-copper\)/, 'Vista previa debe permanecer con relleno');
assert.match(polishCss, /\.quote-deposit-box[\s\S]*background:\s*var\(--quote-graphite\)/, 'El resumen no debe volver al bloque pastel');

console.log('OK · cotización bloqueada por sede y metadata visible');
console.log('OK · items especializados para mobiliario Maderarte');
console.log('OK · identidad comercial oficial protegida');
console.log('OK · PDF omite campos vacíos y anexos sin fotos');
console.log('OK · paleta sobria y acciones con relleno protegidas');
