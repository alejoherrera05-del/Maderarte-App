import assert from 'node:assert/strict';
import { upstreamTimeoutMs } from '../functions/api/maderarte.js';
globalThis.window = { location: { href: 'https://app.example.com/' } };
const { requestTimeoutMs } = await import('../public/js/core/api.js');
for (const action of ['ORDEN_CAPACIDADES','ORDEN_CREAR','ORDENES_LISTAR','COTIZACION_CREAR','COTIZACIONES_LISTAR','RECIBO_CUENTA','RECIBO_CREAR','REMISION_CUENTA','REMISION_CREAR','PRODUCCION_REGISTRAR','SISTEMA_ESTADO','USUARIOS_LISTAR','CLIENTE_OBTENER']) {
  assert.equal(upstreamTimeoutMs(action),90_000);
  assert.equal(requestTimeoutMs(action),120_000);
  assert.ok(requestTimeoutMs(action)>upstreamTimeoutMs(action),'the edge returns its bounded error before the browser abandons');
}
assert.equal(upstreamTimeoutMs('AUTH_LOGIN'),20_000);
assert.equal(requestTimeoutMs('AUTH_LOGIN'),18_000);
assert.equal(upstreamTimeoutMs('PING',true),90_000);
assert.equal(requestTimeoutMs('PING',true),120_000);
assert.equal(requestTimeoutMs('RECIBO_CREAR',false,150_000),150_000);
console.log('OK: bounded business timeouts cover Google latency without changing auth or retry identity.');

