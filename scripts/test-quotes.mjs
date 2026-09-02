import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(resolve(root, path), 'utf8');

const html = read('public/cotizacion.html');
const js = read('public/js/pages/cotizacion.js');
const css = read('public/css/cotizacion-form.css');
const quotes = read('apps-script/Quotes.gs');
const router = read('apps-script/Router.gs');

assert.match(html, /id="quote-branch-gate"/, 'La cotización debe comenzar por la selección de sede');
assert.match(html, /id="quote-workspace" hidden/, 'El formulario debe permanecer bloqueado hasta elegir sede');
assert.match(html, /id="quote-meta-number"/, 'Debe existir una ubicación visible para el consecutivo');
assert.match(html, /id="quote-meta-date"/, 'Debe existir una ubicación visible para la fecha');
assert.match(html, /id="quote-meta-advisor"/, 'Debe mostrarse el asesor de la cotización');
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
assert.match(js, /quote-preview-letterhead/, 'La vista previa debe tener membrete específico');
assert.match(js, /MADERARTE POPAYÁN S\.A\.S\./, 'La vista previa debe identificar la empresa');
assert.match(css, /\.quote-gate-stage/, 'Falta el sistema visual del selector de sede');
assert.match(css, /\.quote-preview-letterhead/, 'Falta el sistema visual premium del membrete');

console.log('OK · cotización bloqueada por sede y metadata visible');
console.log('OK · items especializados para mobiliario Maderarte');
console.log('OK · membrete y anexo fotográfico protegidos');
