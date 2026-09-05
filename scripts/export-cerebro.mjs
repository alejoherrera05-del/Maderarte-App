import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = resolve(root, 'dist/cerebro-manual');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const readCommitted = path => execFileSync('git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8' });

const firstFiles = ['Config.gs', 'SheetHelpers.gs', 'Schema.gs'];
const files = execFileSync('git', ['ls-tree', '--name-only', `${commit}:apps-script`], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(name => name.endsWith('.gs')).sort();
for (const name of firstFiles) assert.ok(files.includes(name), `Falta ${name}`);
const orderedFiles = [...firstFiles, ...files.filter(name => !firstFiles.includes(name))];
const sources = orderedFiles.map(name => ({ name, text: readCommitted(`apps-script/${name}`) }));
const functionNames = sources.flatMap(source => [...source.text.matchAll(/^function\s+([\w$]+)\s*\(/gm)].map(match => match[1]));
assert.equal(new Set(functionNames).size, functionNames.length, 'Hay funciones globales duplicadas.');

const header = `/*
 * MADDY - CEREBRO COMPLETO / Maderarte App
 * Fuente: alejoherrera05-del/Maderarte-App
 * Commit: ${commit}
 * Copiar TODO este archivo en un unico archivo Codigo.gs del proyecto existente.
 * No pegar tambien los modulos separados: duplicaria las funciones.
 * appsscript.json se pega aparte, en el manifiesto de Apps Script.
 * Configurar los valores privados en Propiedades del script, no aqui.
 * Etapa de lectura: las escrituras comerciales permanecen deshabilitadas.
 * Funcion de comprobacion: verificarBaseCero (no crea ni borra registros).
 * Esta copia se genera desde GitHub; conservar el repositorio como fuente.
 */\n\n`;
const bundle = header + sources.map(source => `// ===== INICIO ${source.name} =====\n${source.text}\n// ===== FIN ${source.name} =====\n`).join('\n') + '\n// FIN DEL CEREBRO COMPLETO\n';
const context = vm.createContext({});
new vm.Script(bundle, { filename: 'Codigo.gs' }).runInContext(context, { timeout: 1000 });
for (const name of functionNames) assert.equal(typeof context[name], 'function', `Falta la funcion ${name}`);
for (const name of ['doGet', 'doPost', 'verificarBaseCero', 'listQuotes_', 'listClients_']) assert.equal(typeof context[name], 'function');
assert.equal(context.MADERARTE_APP.COMMERCIAL_WRITES, false);
assert.equal(Object.keys(context.REQUIRED_HEADERS).length, 23);
const manifestSource = readCommitted('apps-script/appsscript.json');
const manifest = JSON.parse(manifestSource);
assert.equal(manifest.runtimeVersion, 'V8');
assert.equal(manifest.timeZone, context.MADERARTE_APP.TIMEZONE);

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, 'Maddy_Cerebro_Completo.txt'), bundle);
writeFileSync(resolve(outputDirectory, 'appsscript.json'), manifestSource);
copyFileSync(resolve(root, 'docs/INSTALACION_CEREBRO_MANUAL.md'), resolve(outputDirectory, 'Instalacion_Maddy_Cerebro.md'));
console.log(`OK · ${sources.length} modulos y ${functionNames.length} funciones reunidos sin duplicados.`);
console.log(`OK · sintaxis y carga del archivo unico; 23 contratos; escrituras comerciales deshabilitadas.`);
console.log(`Commit: ${commit}`);
console.log(outputDirectory);
