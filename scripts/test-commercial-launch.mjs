import assert from 'node:assert/strict';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
function fixture() {
  const f = sandboxRuntime();
  f.state.props.QUOTE_DOCUMENTS_SCHEMA_VERSION = '1';
  f.production().tables.Sedes.rows.forEach(r => { r.Nombre = f.c.INITIAL_BRANCHES_[r.Sede_ID]; });
  for (const role of ['ADMINISTRADOR', 'VENDEDOR', 'BODEGA_LOGISTICA', 'CONSULTA']) f.production().tables.Roles.rows.push({Rol:role,Activo:'SI',Permisos_JSON:'["app.access"]'});
  return f;
}
{
  const f = fixture(), before = JSON.stringify([f.production(),f.state.props]);
  assert.equal(f.c.diagnosticarOperacionComercial().enabled, false);
  assert.equal(JSON.stringify([f.production(),f.state.props]), before, 'diagnostic is read-only');
  assert.equal(f.c.activarOperacionComercial().enabled, true);
  assert.equal(f.c.rcEnabled_(), true); assert.equal(f.c.rmEnabled_(), true); assert.equal(f.c.ptEnabled_(), true);
  const session = f.c.validateSessionToken_('qa-session',false);
  assert.equal(f.c.orderCreationCapabilities_(session).enabled, true);
  assert.equal(f.c.quoteWritesEnabled_(), true);
  assert.equal(f.production().tables.Sedes.rows[0].Siguiente_OP, 1, 'activation never consumes a number');
  assert.equal(f.production().tables.Ordenes_Pedido.rows.length, 0);
  assert.equal(f.c.pausarOperacionComercial().enabled, false);
  assert.equal(f.c.rcEnabled_(), false); assert.equal(f.c.rmEnabled_(), false); assert.equal(f.c.ptEnabled_(), false);
  assert.equal(f.c.orderCreationCapabilities_(session).enabled, false);
  assert.equal(f.c.quoteWritesEnabled_(), true, 'independent quotation activation is preserved');
}
for (const [setup, code] of [
  [f=>{f.state.props.ORDER_CREATION_PENDING=JSON.stringify({requestId:'PENDING',uid:'qa-owner',fingerprint:'abc'});}, 'LAUNCH_PENDING_TRANSACTION'],
  [f=>{f.production().tables.Sedes.rows[0].Siguiente_OP=0;}, 'NUMBERING_NOT_READY'],
  [f=>{f.production().tables.Registro_Numeros.rows.push({Numero:'MP-OP-0001'});}, 'NUMBER_ALREADY_USED'],
  [f=>{f.production().tables.Archivos_Orden.rows.push({Estado:'PENDIENTE'});}, 'LAUNCH_DOCUMENTS_PENDING'],
  [f=>{f.state.files.get('production-docs').trashed=true;}, 'LAUNCH_DRIVE_INVALID'],
  [f=>{f.production().tables.Usuarios.rows[0].Estado='INACTIVO';}, 'OWNER_NOT_READY']
]) {
  const f=fixture();setup(f);const before=JSON.stringify([f.production(),f.state.props]);
  assert.throws(()=>f.c.activarOperacionComercial(),e=>e.appCode===code,code);
  assert.equal(JSON.stringify([f.production(),f.state.props]),before,'rejection preserves records and properties');
  assert.equal(f.c.commercialWritesEnabled_(),false);
}
{
  const f=fixture(); f.state.loseBatch=true;
  assert.throws(()=>f.c.activarOperacionComercial());
  assert.equal(f.c.commercialWritesEnabled_(),false,'ambiguous mode write cannot activate sales');
}
console.log('OK: commercial launch, pause, read-only preflight, numbering and fail-closed activation.');

