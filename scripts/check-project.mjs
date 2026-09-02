import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const version = '0.2.0';
const required = [
  'README.md', 'AGENTS.md', 'package.json', 'package-lock.json', 'wrangler.toml',
  '.github/workflows/quality.yml',
  'public/login.html', 'public/activar-cuenta.html', 'public/index.html', 'public/clientes.html', 'public/ordenes.html',
  'public/orden.html', 'public/perfil.html', 'public/configuracion.html', 'public/404.html',
  'public/manifest.webmanifest', 'public/_headers', 'public/_redirects',
  'public/assets/brand/README.md', 'public/css/clientes-parity.css', 'public/css/dashboard-parity.css',
  'public/js/core/config.js', 'public/js/core/format.js', 'public/js/core/session.js',
  'public/js/core/api.js', 'public/js/core/auth.js', 'public/js/core/permissions.js',
  'public/js/core/ui.js', 'public/js/core/shell.js', 'public/js/core/page-guard.js',
  'public/js/pages/login.js', 'public/js/pages/activar-cuenta.js', 'public/js/pages/dashboard.js',
  'public/js/pages/clientes.js', 'public/js/pages/ordenes.js', 'public/js/pages/orden.js', 'public/js/pages/perfil.js',
  'public/js/pages/configuracion.js', 'functions/api/maderarte.js',
  'worker/index.js', 'scripts/test-worker.mjs', 'scripts/test-apps-script.mjs', 'scripts/test-clients.mjs',
  'apps-script/Config.gs', 'apps-script/SheetHelpers.gs', 'apps-script/Schema.gs',
  'apps-script/DriveFolders.gs', 'apps-script/Auth.gs', 'apps-script/Clients.gs', 'apps-script/Orders.gs',
  'apps-script/Router.gs', 'apps-script/appsscript.json', 'apps-script/README.md',
  'docs/HOMEEASY_PARITY_MAP.md'
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = join(directory, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const path of required) assert.ok(existsSync(join(root, path)), `Falta ${path}`);
const files = walk(root);
const relativeFiles = files.map(file => relative(root, file).replaceAll('\\', '/'));

const forbiddenExtensions = new Set(['.csv', '.tsv', '.xls', '.xlsx', '.xlsb', '.ods', '.pdf', '.zip', '.7z', '.rar', '.pem', '.key', '.p12', '.pfx', '.ttf', '.otf', '.woff', '.woff2']);
for (const file of relativeFiles) assert.ok(!forbiddenExtensions.has(extname(file).toLowerCase()), `Archivo prohibido en repositorio público: ${file}`);

const textExtensions = new Set(['.md', '.json', '.toml', '.yml', '.yaml', '.html', '.css', '.js', '.mjs', '.gs', '.txt', '']);
const textFiles = files.filter(file => textExtensions.has(extname(file).toLowerCase()) || ['.gitignore', '.editorconfig', '.env.example', '_headers', '_redirects', '.nojekyll'].includes(file.split('/').pop()));
const joinedText = textFiles.map(file => readFileSync(file, 'utf8')).join('\n');
const publicText = textFiles
  .filter(file => relative(root, file).replaceAll('\\', '/').startsWith('public/'))
  .map(file => readFileSync(file, 'utf8'))
  .join('\n');

const forbiddenValues = [
  ['script.google.com/macros/', 's/'].join(''),
  ['Maderarte App - ', 'PRUEBAS'].join(''),
  ['MADERARTE APP — ', 'SISTEMA 2026'].join('')
];
for (const value of forbiddenValues) assert.ok(!joinedText.includes(value), `Contenido privado o anterior encontrado: ${value}`);
assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(joinedText), 'Se encontró una clave privada');
assert.ok(!/\b[^@\s]+@(?:gmail|hotmail|outlook|icloud)\.com\b/i.test(joinedText), 'Se encontró un correo personal');
assert.ok(!/(?:SPREADSHEET_ID|DRIVE_DOCUMENTS_ROOT_ID)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/i.test(joinedText), 'Se encontró un ID privado configurado directamente');
assert.ok(!/(?:uid|UID_Firebase)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/i.test(joinedText), 'Se encontró un UID personal configurado directamente');
assert.ok(!/SpreadsheetApp\.openById\(['"][^'"]+['"]\)/.test(joinedText), 'Se encontró un Spreadsheet ID fijo');
assert.ok(!/DriveApp\.getFolderById\(['"][^'"]+['"]\)/.test(joinedText), 'Se encontró un Drive folder ID fijo');
assert.doesNotMatch(publicText, /homeeasy/i, 'La interfaz pública contiene una referencia a HomeEasy');

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
assert.equal(packageJson.version, version);
assert.equal(packageLock.version, version);
assert.equal(packageLock.packages[''].version, version);
assert.equal(JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8')).name, 'Maderarte App');
assert.equal(JSON.parse(readFileSync(join(root, 'apps-script/appsscript.json'), 'utf8')).runtimeVersion, 'V8');

const wranglerSource = readFileSync(join(root, 'wrangler.toml'), 'utf8');
assert.match(wranglerSource, /^main\s*=\s*["']\.\/worker\/index\.js["']/m, 'Wrangler no apunta al Worker principal');
assert.match(wranglerSource, /^\[assets\]$/m, 'Falta la configuración de Static Assets');
assert.match(wranglerSource, /directory\s*=\s*["']\.\/public["']/, 'Static Assets no apunta a public');
assert.match(wranglerSource, /binding\s*=\s*["']ASSETS["']/, 'Falta el binding ASSETS');
assert.match(wranglerSource, /html_handling\s*=\s*["']none["']/, 'Las rutas .html deben conservarse sin reescrituras automáticas');
assert.match(wranglerSource, /not_found_handling\s*=\s*["']404-page["']/, 'Falta la página 404 de Static Assets');
assert.match(wranglerSource, /run_worker_first\s*=\s*\[[\s\S]*["']\/api\/maderarte["']/, 'La API debe ejecutar primero el Worker');
assert.doesNotMatch(wranglerSource, /pages_build_output_dir/, 'No debe quedar configuración de Pages');

for (const file of files.filter(file => ['.js', '.mjs'].includes(extname(file)))) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
for (const file of files.filter(file => extname(file) === '.gs')) {
  const source = readFileSync(file, 'utf8');
  new Function(source);
}

const publicRoot = join(root, 'public');
for (const htmlFile of files.filter(file => extname(file) === '.html')) {
  const html = readFileSync(htmlFile, 'utf8');
  assert.ok(!/<style\b/i.test(html), `CSS inline en ${relative(root, htmlFile)}`);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `JavaScript inline en ${relative(root, htmlFile)}`);
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map(match => match[1].split(/[?#]/)[0]);
  for (const ref of refs) {
    if (ref === '/') continue;
    assert.ok(existsSync(join(publicRoot, ref)), `Referencia inexistente ${ref} en ${relative(root, htmlFile)}`);
  }
}

const staticIdChecks = {
  'public/js/pages/login.js': 'public/login.html',
  'public/js/pages/activar-cuenta.js': 'public/activar-cuenta.html'
};
for (const [jsPath, htmlPath] of Object.entries(staticIdChecks)) {
  const js = readFileSync(join(root, jsPath), 'utf8');
  const html = readFileSync(join(root, htmlPath), 'utf8');
  const ids = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
  for (const id of ids) assert.match(html, new RegExp(`id=["']${id}["']`), `${id} no existe en ${htmlPath}`);
}

const router = readFileSync(join(root, 'apps-script/Router.gs'), 'utf8');
const routeActions = new Set([...router.matchAll(/case '([A-Z0-9_]+)'/g)].map(match => match[1]));
const requiredActions = ['AUTH_LOGIN', 'AUTH_SESSION_VALIDATE', 'AUTH_LOGOUT', 'INVITACION_VALIDAR', 'INVITACION_ACTIVAR', 'DASHBOARD_RESUMEN', 'CLIENTES_LISTAR', 'CLIENTE_OBTENER', 'ORDENES_LISTAR', 'ORDEN_OBTENER', 'SISTEMA_ESTADO', 'USUARIOS_LISTAR', 'INVITACION_CREAR'];
for (const action of requiredActions) assert.ok(routeActions.has(action), `Falta la acción ${action} en Router.gs`);

const schemaSource = readFileSync(join(root, 'apps-script/Schema.gs'), 'utf8');
const requiredSheetContracts = [
  'Clientes', 'Usuarios', 'Roles', 'Configuracion', 'Sedes', 'Invitaciones', 'Sesiones',
  'Cotizaciones', 'Ordenes_Pedido', 'Orden_Items', 'Produccion', 'Abonos', 'Remisiones',
  'Remision_Items', 'Agenda', 'Documentos', 'Auditoria', 'Anulaciones', 'Versiones_Documentos',
  'Lotes_Numeracion', 'Registro_Numeros', 'Idempotencia', 'Catalogos'
];
for (const sheetName of requiredSheetContracts) assert.match(schemaSource, new RegExp(`\\b${sheetName}:\\s*\\[`), `Falta el contrato de ${sheetName}`);
assert.match(schemaSource, /function verificarBaseCero\(/, 'Falta verificarBaseCero');
assert.match(schemaSource, /COMMERCIAL_BASE_NOT_ZERO/, 'El diagnóstico no protege la base comercial vacía');
assert.match(schemaSource, /DRIVE_ROOT_MISMATCH/, 'El diagnóstico no valida la raíz documental');
const sedesContract = schemaSource.match(/Sedes:\s*\[([^\]]+)\]/);
assert.ok(sedesContract, 'Falta el contrato de Sedes en Schema.gs');
const sedesHeaders = [...sedesContract[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
assert.deepEqual(sedesHeaders, [
  'Sede_ID', 'Nombre', 'Prefijo_OP', 'Prefijo_Cotizacion', 'Prefijo_Recibo', 'Prefijo_Remision',
  'Direccion', 'Telefono', 'Estado', 'Siguiente_OP', 'Siguiente_Cotizacion', 'Siguiente_Recibo',
  'Siguiente_Remision', 'Actualizado_En'
], 'El contrato de Sedes cambió o perdió columnas');

const sheetHelpersSource = readFileSync(join(root, 'apps-script/SheetHelpers.gs'), 'utf8');
assert.match(sheetHelpersSource, /function duplicateHeaders_\(/, 'Falta la detección de encabezados repetidos');
assert.match(sheetHelpersSource, /SHEET_SCHEMA_DUPLICATE_HEADER/, 'Falta el error para encabezados repetidos');
const configSource = readFileSync(join(root, 'apps-script/Config.gs'), 'utf8');
assert.match(configSource, /COMMERCIAL_WRITES:\s*false/, 'Las escrituras comerciales deben permanecer deshabilitadas');
const routerSource = readFileSync(join(root, 'apps-script/Router.gs'), 'utf8');
assert.match(routerSource, /requiredProperty_\('MADERARTE_PROXY_TOKEN'\)/, 'Apps Script debe usar MADERARTE_PROXY_TOKEN');

const clientsSource = readFileSync(join(root, 'apps-script/Clients.gs'), 'utf8');
assert.match(clientsSource, /requirePermission_\(session, 'clientes\.read'\)/, 'Clientes debe exigir clientes.read');
assert.match(clientsSource, /function listClients_\(/, 'Falta listClients_');
assert.match(clientsSource, /function getClient_\(/, 'Falta getClient_');

const formatSource = readFileSync(join(root, 'public/js/core/format.js'), 'utf8');
assert.match(formatSource, /export function safeInternalUrl\(/, 'Falta safeInternalUrl');
const versionFiles = ['public/js/core/config.js', 'functions/api/maderarte.js', 'apps-script/Config.gs', 'README.md'];
for (const file of versionFiles) assert.ok(readFileSync(join(root, file), 'utf8').includes(version), `Versión incoherente en ${file}`);

assert.ok(relativeFiles.length >= 50, 'La fundación parece incompleta');
console.log(`OK · ${relativeFiles.length} archivos verificados`);
console.log('OK · sintaxis JavaScript y Apps Script');
console.log('OK · referencias HTML y recursos locales');
console.log('OK · sin datos comerciales, IDs privados ni secretos');
console.log('OK · contratos de API y versión 0.2.0 coherentes');
console.log('OK · Cloudflare Worker y Static Assets protegidos');
console.log('OK · Clientes protegido por permisos y rutas de lectura');
console.log('OK · encabezados únicos y contrato de Sedes protegido');
console.log('OK · recursos de marca sin derivados no aprobados');
