import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('scripts/support/diagnosticar-acceso-google.gs', 'utf8');
const ids = { SPREADSHEET_ID: 'PRIVATE_SHEET', DRIVE_DOCUMENTS_ROOT_ID: 'PRIVATE_DRIVE' };
function run(responses = [], options = {}) {
  const calls = []; const logs = [];
  const ctx = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({getProperty: key => options.missing === key ? '' : ids[key]}) },
    ScriptApp: {getOAuthToken: () => { if (options.authFail) throw new Error('SECRET_OAUTH'); return 'SECRET_TOKEN'; }},
    Logger: {log: text => logs.push(text)},
    UrlFetchApp: {fetch: (url, request) => {
      calls.push({url, request});
      const result = responses[calls.length - 1];
      if (result instanceof Error) throw result;
      assert.ok(result, 'No unexpected network call');
      return {getResponseCode: () => result.code, getContentText: () => typeof result.body === 'string' ? result.body : JSON.stringify(result.body)};
    }}
  });
  vm.runInContext(source, ctx);
  const output = JSON.parse(JSON.stringify(ctx.diagnosticarAccesoGoogleMaddy()));
  for (const c of calls) { assert.equal(c.request.method,'get'); assert.equal(c.request.followRedirects,false); assert.equal(c.request.payload,undefined); }
  assert.equal(output.soloLectura,true); assert.equal(output.guardadoComercialVerificado,false);
  for (const secret of [...Object.values(ids),'SECRET_TOKEN','PRIVATE_ERROR','SECRET_OAUTH','secretReason']) assert.ok(!logs.join('').includes(secret));
  assert.ok(calls.length <= 2);
  return {output,calls};
}
const sheet = {code:200,body:{spreadsheetId:ids.SPREADSHEET_ID,properties:{title:'Base de Datos Maderarte App'},sheets:[{properties:{title:'Ordenes_Pedido',gridProperties:{columnCount:31}}}]}};
const drive = {code:200,body:{id:ids.DRIVE_DOCUMENTS_ROOT_ID,name:'02_DOCUMENTOS_CLIENTES',mimeType:'application/vnd.google-apps.folder',trashed:false,capabilities:{canAddChildren:true}}};
let count = 0;
let r = run([sheet,drive]); assert.equal(r.output.accesoLecturaOk,true); assert.equal(r.output.pruebas[0].columnasPedido,31); count++;
for (const reason of ['SERVICE_DISABLED','ACCESS_TOKEN_SCOPE_INSUFFICIENT','accessNotConfigured','insufficientPermissions']) {
  r = run([{code:403,body:{error:{status:'PERMISSION_DENIED',message:'PRIVATE_ERROR',details:[{reason}],errors:[{reason}]}}},drive]);
  assert.deepEqual(r.output.pruebas[0].motivos,[reason]); assert.equal(r.output.accesoLecturaOk,false); count++;
}
for (const code of [400,401,403,404,429,500,503]) {
  r = run([{code,body:{error:{status:'INVALID_ARGUMENT',message:'PRIVATE_ERROR',details:[{reason:'secretReason'}]}}},drive]);
  assert.equal(r.output.pruebas[0].http,code); assert.deepEqual(r.output.pruebas[0].motivos,[]); count++;
}
r=run([{code:503,body:'<html>PRIVATE_ERROR</html>'},drive]); assert.equal(r.output.pruebas[0].estadoGoogle,'NO_IDENTIFICADO'); count++;
r=run([new Error('PRIVATE_ERROR'),drive]); assert.equal(r.output.pruebas[0].error,'CONSULTA_NO_COMPLETADA'); count++;
r=run([drive],{missing:'SPREADSHEET_ID'}); assert.equal(r.output.pruebas[0].error,'FALTA_SPREADSHEET_ID'); count++;
r=run([],{authFail:true}); assert.equal(r.calls.length,0); count++;
r=run([{code:200,body:{spreadsheetId:'WRONG_ID'}},drive]); assert.equal(r.output.accesoLecturaOk,false); count++;
// Loading all production modules with the support helper must be syntax-safe.
const bundle = fs.readdirSync('apps-script').filter(name => name.endsWith('.gs')).sort()
  .map(name => fs.readFileSync('apps-script/' + name, 'utf8')).join('\n');
assert.ok(!bundle.includes('function diagnosticarAccesoGoogleMaddy('));
new vm.Script(bundle + '\n' + source);
console.log(`OK: ${count} escenarios simulados. Solo GET; sin cambios en Sheets/Drive/propiedades; sin secretos en el registro; sin redefinir funciones del Cerebro.`);
