import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// In-memory Sheets adapter: apply the actual generated REST requests to an
// isolated copy, then commit together. This is NOT a live Google integration test.
const sources = ['Config', 'SheetHelpers', 'Schema', 'Orders', 'OrderCreation', 'Router'];
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function equal(actual, expected, why) { assert.deepEqual(clone(actual), clone(expected), why); checks++; }
function throws(fn, code) { assert.throws(fn, error => error.appCode === code, code); checks++; }
function fixture() {
  const state = { tables: {}, calls: 0, gets: 0, failAt: -1, loseResponse: false, locked: false, busy: false, releases: 0, authReads: 0,
    props: { ORDER_SCHEMA_VERSION: '2', ORDER_SAVE_ENABLED: 'SI', SPREADSHEET_ID: 'synthetic-sheet' } };
  const session = { profile: { uid: 'qa-owner', name: 'Operador QA', role: 'PROPIETARIO', branches: ['MP'] }, permissions: ['*'], sessionRow: { Dispositivo_ID: 'test-device' } };
  function getSheet(name) {
    const table = state.tables[name];
    return table && {
      getName: () => name, getSheetId: () => Object.keys(state.tables).indexOf(name) + 1,
      getMaxColumns: () => table.headers.length, getLastColumn: () => table.headers.length, getLastRow: () => table.rows.length + 1,
      getRange: (r, c, nr = 1, nc = 1) => ({
        getDisplayValues: () => [table.headers.slice(c - 1, c - 1 + nc)],
        getValues: () => table.rows.slice(r - 2, r - 2 + nr).map(row => table.headers.slice(c - 1, c - 1 + nc).map(header => row[header] ?? ''))
      })
    };
  }
  const context = vm.createContext({ console, __state: state,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state.props[key] || '', setProperty: (key, value) => { state.props[key] = value; } }) },
    SpreadsheetApp: { openById: () => { state.gets++; return { getName: () => 'Base de Datos Maderarte App', getSheetByName: getSheet }; }, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => { if(state.busy || state.locked) return false; state.locked = true; return true; }, releaseLock: () => { state.locked = false; state.releases++; } }) },
    ScriptApp: { getOAuthToken: () => 'synthetic-oauth' },
    UrlFetchApp: { fetch: (url, options) => {
      assert.equal(state.locked, true, 'All REST writes hold the script lock');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-oauth');
      assert.match(url, /^https:\/\/sheets.googleapis.com\/v4\/spreadsheets\/synthetic-sheet:batchUpdate$/);
      state.calls++;
      const batch = JSON.parse(options.payload);
      const tables = clone(state.tables);
      batch.requests.forEach((request, index) => {
        if(index === state.failAt) throw new Error('synthetic batch rejection');
        if (request.appendDimension) return;
        const requestBody = request.appendCells || request.updateCells;
        const id = request.appendCells ? requestBody.sheetId : requestBody.start.sheetId;
        const table = tables[Object.keys(tables)[id - 1]];
        const read = cell => {
          const value = cell.userEnteredValue || {};
          assert.equal(value.formulaValue, undefined, 'Never execute user input as a formula');
          return value.stringValue ?? value.numberValue ?? '';
        };
        if(request.appendCells) {
          for(const row of requestBody.rows) table.rows.push(Object.fromEntries(table.headers.map((header, i) => [header, read(row.values[i])])));
        } else {
          if (requestBody.start.rowIndex === 0) {
            requestBody.rows[0].values.forEach((cell, i) => { table.headers[requestBody.start.columnIndex + i] = read(cell); });
            return;
          }
          const rowIndex = requestBody.start.rowIndex - 1;
          const col = requestBody.start.columnIndex;
          requestBody.rows[0].values.forEach((cell, i) => { table.rows[rowIndex][table.headers[col + i]] = read(cell); });
        }
      });
      state.tables = tables;
      if(state.loseResponse) { state.loseResponse = false; throw new Error('response lost AFTER commit'); }
      return { getResponseCode: () => 200 };
    } }
  });
  for(const name of sources) vm.runInContext(readFileSync(`apps-script/${name}.gs`, 'utf8'), context, { filename: `${name}.gs` });
  context.MADERARTE_APP = { ...context.MADERARTE_APP, COMMERCIAL_WRITES: true };
  context.sha256_ = text => createHash('sha256').update(text).digest('hex');
  context.now_ = () => new Date('2026-09-07T17:00:00Z');
  context.validateSessionToken_ = token => { state.authReads++; assert.equal(token, 'qa-session'); return session; };
  for(const [name, headers] of Object.entries(context.REQUIRED_HEADERS)) state.tables[name] = { headers: [...headers, ...(context.ORDER_CREATION_EXTRA_HEADERS_[name] || [])], rows: [] };
  state.tables.Configuracion.rows.push({ Clave: 'MODO_OPERACION', Valor: 'OPERACION' });
  state.tables.Sedes.rows.push({ Sede_ID: 'MP', Estado: 'ACTIVA', Prefijo_OP: 'MP-OP', Prefijo_Recibo: 'MP-RC', Siguiente_OP: 1, Siguiente_Recibo: 1 });
  const request = { requestId: 'QA-ORDER-CREATION-0001', sessionToken: 'qa-session' };
  const item = (id, price, agreement = 'ENTREGA_POSTERIOR', fulfillment = 'PARA_SOLICITAR') => ({
    clientLineId: id, description: `Mueble sintético ${id}`, quantity: 1, unitValue: price,
    fabric: 'Acabado de prueba', specifications: 'Medidas de prueba', agreement, fulfillment
  });
  const payload = { schemaVersion: 1, branch: 'MP', client: { document: '000001', name: 'Cliente sintético', phone: '000002', email: 'N/A', address: 'Dirección de prueba', city: 'Ciudad de prueba' },
    items: [item('1', 2000000, 'ENTREGA_HOY', 'DISPONIBLE'), item('2', 1500000)], discount: 350000, notes: 'Acuerdo público', noPayment: false,
    payments: [{ clientPaymentId: '1', amount: 400000, method: 'TRANSFERENCIA', internalNote: 'NOTA-PRIVADA' }, { clientPaymentId: '2', amount: 100000, method: 'EFECTIVO' }] };
  return { context, state, session, request, payload, create: () => context.createOrder_(payload, request), rows: name => state.tables[name].rows };
}

{
  const f=fixture(); f.context.MADERARTE_APP.COMMERCIAL_WRITES=false;
  throws(f.create,'COMMERCIAL_WRITES_DISABLED'); equal(f.state.calls,0); equal(f.state.gets,0);
  f.context.MADERARTE_APP.COMMERCIAL_WRITES=true; f.state.props.ORDER_SAVE_ENABLED='NO';
  throws(f.create,'COMMERCIAL_WRITES_DISABLED'); equal(f.state.calls,0);
  f.state.props.ORDER_SAVE_ENABLED='SI'; f.rows('Configuracion')[0].Valor='PREPARACION';
  throws(f.create,'COMMERCIAL_WRITES_DISABLED'); equal(f.state.calls,0);
}
{
  const f=fixture(); const before=JSON.stringify(f.payload); const saved=f.create();
  equal(JSON.stringify(f.payload),before); equal(saved.order.number,'MP-OP-0001'); equal(saved.order.total,3150000); equal(saved.order.paid,500000);
  equal(f.rows('Ordenes_Pedido').length,1); equal(f.rows('Orden_Items').length,2); equal(f.rows('Abonos').length,2);
  equal(f.rows('Clientes')[0].Cedula_NIT,'000001'); equal(f.rows('Orden_Items').map(x=>x.Acuerdo),['ENTREGA_HOY','ENTREGA_POSTERIOR']);
  equal(f.rows('Orden_Items').map(x=>x.Valor_Neto),[1800000,1350000]); equal(f.rows('Orden_Items').map(x=>x.Cantidad_Entregada),[0,0]);
  equal(f.rows('Remisiones').length,0); equal(f.rows('Produccion').length,0); equal(f.rows('Documentos').length,0);
  equal(f.rows('Abonos').map(x=>x.Saldo_Anterior),[3150000,2750000]); equal(f.rows('Abonos').map(x=>x.Saldo_Nuevo),[2750000,2650000]);
  equal(f.rows('Abonos')[0].Nota_Interna,'NOTA-PRIVADA'); equal(f.rows('Abonos')[0].Comentario,'');
  equal(f.rows('Sedes')[0].Siguiente_OP,2); equal(f.rows('Sedes')[0].Siguiente_Recibo,3); equal(f.rows('Registro_Numeros').length,3);
  const read=f.context.getOrder_({number:saved.order.number},f.session);
  equal(read.items[1].fulfillment,'PARA_SOLICITAR'); equal(read.items[1].net,1350000); equal(read.order.documentStatus,'PENDIENTE');
  assert.doesNotMatch(JSON.stringify([saved,read,f.rows('Auditoria'),f.rows('Idempotencia')]),/NOTA-PRIVADA/); checks++;
  const repeat=f.create(); equal(repeat.replayed,true); equal(repeat.order,saved.order); equal(f.state.calls,1);
  f.payload.items[0].description='Cambio'; throws(f.create,'REQUEST_CONTENT_CHANGED'); equal(f.state.calls,1);
  f.payload.items[0].description='Mueble sintético 1'; f.payload.payments[0].internalNote='Otra nota'; throws(f.create,'REQUEST_CONTENT_CHANGED');
  equal(f.context.orderCreationStatus_({requestId:f.request.requestId},f.request).order,saved.order);
  f.session.profile.uid='qa-other'; throws(f.create,'REQUEST_ID_CONFLICT');
  throws(()=>f.context.orderCreationStatus_({requestId:f.request.requestId},f.request),'REQUEST_ID_CONFLICT');
  equal(f.state.locked,false);
}
{
  const f=fixture(); f.state.loseResponse=true;
  throws(f.create,'ORDER_SAVE_UNCERTAIN'); equal(f.rows('Ordenes_Pedido').length,1);
  equal(f.context.orderCreationStatus_({requestId:f.request.requestId},f.request).saved,true);
  equal(f.create().replayed,true); equal(f.state.calls,1); equal(f.rows('Abonos').length,2);
}
// Failure at every possible request position must not partially commit any row.
{
  const probe=fixture(); const draft=probe.context.normalizeOrderCreation_(probe.payload);
  const batch=probe.context.buildOrderCreationBatch_(draft,probe.request.requestId,probe.session,{...probe.rows('Sedes')[0],_row:2},null,'test-hash');
  for(let index=0;index<batch.requests.length;index++){
    const f=fixture(); const before=clone(f.state.tables); f.state.failAt=index;
    throws(f.create,'ORDER_SAVE_UNCERTAIN'); equal(f.state.tables,before,`batch failure ${index}`);
    equal(f.context.orderCreationStatus_({requestId:f.request.requestId},f.request).saved,false);
    f.state.failAt=-1; equal(f.create().order.number,'MP-OP-0001'); equal(f.rows('Ordenes_Pedido').length,1);
  }
}
{
  const f=fixture(); f.payload.noPayment=true; f.payload.payments=[]; f.create();
  equal(f.rows('Abonos').length,0); equal(f.rows('Sedes')[0].Siguiente_Recibo,1); equal(f.rows('Ordenes_Pedido')[0].Fecha_Ultimo_Abono,'');
}
{
  const f=fixture(); f.rows('Clientes').push({Cedula_NIT:'000001',Nombre_Completo:'Nombre original',Telefono:'00100',Direccion:'Dirección original',Estado:'ACTIVO'});
  f.create(); equal(f.rows('Clientes').length,1); equal(f.rows('Clientes')[0].Direccion,'Dirección original'); equal(f.rows('Clientes')[0].Nombre_Completo,'Nombre original');
  equal(f.rows('Ordenes_Pedido')[0].Direccion_Entrega,'Dirección de prueba');
}
{
  const f=fixture(); f.payload.items[0].description='=HYPERLINK("example","text")'; f.create();
  equal(f.rows('Orden_Items')[0].Descripcion,f.payload.items[0].description);
}
for(const mutate of [
  f=>f.payload.items[0].quantity=0, f=>f.payload.items[0].quantity=1.5,
  f=>f.payload.items[0].unitValue=-1, f=>f.payload.items[0].unitValue=Number.MAX_SAFE_INTEGER,
  f=>f.payload.items[0].quantity=Number.MAX_SAFE_INTEGER, f=>f.payload.discount=999999999,
  f=>f.payload.items[1].clientLineId='1', f=>f.payload.items[0].fulfillment='PARA_SOLICITAR',
  f=>f.payload.client.document=1001, f=>f.payload.client.email='invalid', f=>f.payload.client.address='',
  f=>f.payload.payments[0].amount=4000000, f=>f.payload.payments[0].amount=-2,
  f=>f.payload.payments[0].amount='500', f=>f.payload.payments[0].method='OTHER',
  f=>f.payload.payments[1].clientPaymentId='1', f=>f.payload.noPayment=true,
  f=>f.payload.items=[], f=>f.payload.total=1
]) { const f=fixture(); mutate(f); throws(f.create,'ORDER_INPUT_INVALID'); equal(f.state.calls,0); }
{
  const f=fixture(); f.payload.items[0].photos=['data:image/png;base64,test']; throws(f.create,'ORDER_PHOTOS_NOT_READY'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.state.busy=true; throws(f.create,'ORDER_SAVE_BUSY'); equal(f.state.authReads,0); equal(f.state.calls,0); equal(f.state.releases,0);
}
{
  const f=fixture(); f.context.validateSessionToken_=()=>{throw Object.assign(new Error('revoked'),{appCode:'SESSION_REVOKED'});};
  throws(f.create,'SESSION_REVOKED'); equal(f.state.locked,false); equal(f.state.calls,0);
}
for (const permissions of [[],['ordenes.create'],['ordenes.create','abonos.create']]) {
  const f=fixture(); f.session.permissions=permissions; throws(f.create,'PERMISSION_DENIED'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.session.permissions=['ordenes.create','clientes.create','abonos.create']; f.session.profile.branches=['TP'];
  throws(f.create,'BRANCH_NOT_ALLOWED'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.state.tables.Abonos.headers.pop(); throws(f.create,'SHEET_SCHEMA_MISMATCH'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.state.props.ORDER_SCHEMA_VERSION='1'; throws(f.create,'ORDER_SCHEMA_NOT_READY'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.rows('Registro_Numeros').push({Numero:'MP-OP-0001',Estado:'ANULADO'}); throws(f.create,'NUMBER_ALREADY_USED'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.rows('Sedes')[0].Siguiente_OP='not-a-number'; throws(f.create,'NUMBERING_NOT_READY'); equal(f.state.calls,0);
}
{
  const f=fixture(); f.payload.items[0].unitValue=1; f.payload.items[1].unitValue=2; f.payload.discount=1; f.payload.payments=[];f.payload.noPayment=true;
  f.create(); equal(f.rows('Orden_Items').map(x=>x.Descuento),[0,1]); equal(f.rows('Orden_Items').reduce((a,x)=>a+x.Valor_Neto,0),2);
}
{
  const f=fixture(); equal(f.context.orderCreationCapabilities_(f.session).enabled,false);
  f.context.MADERARTE_APP.COMMERCIAL_WRITES=false;
  throws(()=>f.context.routeAction_('ORDEN_CREAR',f.payload,f.request),'COMMERCIAL_WRITES_DISABLED');
  equal(f.context.routeAction_('ORDEN_CREACION_ESTADO',{requestId:f.request.requestId},f.request).saved,false);
  equal(f.context.routeAction_('ORDEN_CAPACIDADES',{}, {session:f.session}).enabled,false);
}
{
  const f=fixture(); f.context.MADERARTE_APP.COMMERCIAL_WRITES=false; f.rows('Configuracion')[0].Valor='PREPARACION';
  f.state.props.ORDER_SCHEMA_VERSION='1';
  for (const [name,headers] of Object.entries(f.context.REQUIRED_HEADERS)) f.state.tables[name].headers=[...headers];
  equal(f.context.prepararEsquemaGuardadoOrdenes().schemaVersion,2);
  equal(f.context.verifySchema_(),true); equal(f.rows('Ordenes_Pedido').length,0);
  equal(f.state.props.ORDER_SCHEMA_VERSION,'2'); const calls=f.state.calls;
  f.context.prepararEsquemaGuardadoOrdenes(); equal(f.state.calls,calls,'Schema setup is idempotent');
  f.rows('Clientes').push({Cedula_NIT:'000001'});
  throws(()=>f.context.prepararEsquemaGuardadoOrdenes(),'COMMERCIAL_BASE_NOT_ZERO'); equal(f.state.calls,calls);
}
{
  const f=fixture(); f.context.MADERARTE_APP.COMMERCIAL_WRITES=false; f.rows('Configuracion')[0].Valor='PREPARACION';
  for (const [name,headers] of Object.entries(f.context.REQUIRED_HEADERS)) f.state.tables[name].headers=[...headers];
  f.state.props.ORDER_SCHEMA_VERSION='1';f.state.loseResponse=true;
  assert.throws(()=>f.context.prepararEsquemaGuardadoOrdenes()); checks++;
  equal(f.state.props.ORDER_SCHEMA_VERSION,'1');
  f.context.prepararEsquemaGuardadoOrdenes(); equal(f.context.verifySchema_(),true); equal(f.state.calls,1);
}
console.log(`OK · ${checks} comprobaciones de creación, lectura, importes, permisos, privacidad y recuperación con adaptador simulado. No se escribió en Google.`);
