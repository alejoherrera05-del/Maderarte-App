import assert from 'node:assert/strict';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
import { loadQuoteOrder, conversionNumber } from '../public/js/core/quote-to-order.js';

function fixture() {
  const f = sandboxRuntime(); f.start();
  const { payments, noPayment, ...quote } = structuredClone(f.command);
  quote.items = quote.items.map(({ agreement, fulfillment, ...item }) => item);
  const number = f.run('COTIZACION_CREAR', quote, 'QUOTE-CONVERSION-SOURCE-01').quote.number;
  const photo = f.rows('Archivos_Cotizacion').find(x=>x.Tipo==='FOTO');
  f.run('COTIZACION_FOTO_GUARDAR',{number,id:photo.Archivo_ID,base64:f.photo.toString('base64')});
  const plan=f.run('INTERNO_COTIZACION_DOCUMENTO_PREPARAR',{number});
  f.run('INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR',{number,id:plan.id,planHash:plan.planHash,base64:Buffer.from('%PDF-1.4\nfixture\n%%EOF').toString('base64')});
  const prepared=f.run('COTIZACION_PREPARAR_PEDIDO',{number});
  f.command.quoteOrigin={number,fingerprint:prepared.fingerprint};
  return {...f,number,prepared};
}
{
  const f=fixture(), before=JSON.stringify(f.state.books);
  const loaded=await loadQuoteOrder(f.number,async(action,payload)=>({data:f.run(action,payload)}));
  assert.equal(JSON.stringify(f.state.books),before,'prefill never writes');
  assert.equal(loaded.draft.itemIds.length,2); assert.equal(loaded.draft.photos[0][1].length,1);
  assert.equal(loaded.draft.photos[1][1].length,0); assert.equal(loaded.origin.fingerprint,f.prepared.fingerprint);
  const saved=f.run('ORDEN_CREAR',f.command);
  assert.equal(saved.order.quoteOrigin,f.number);
  assert.equal(f.rows('Ordenes_Pedido')[0].Cotizacion_Origen,f.number);
  assert.equal(f.rows('Cotizaciones')[0].Convertida_OP,saved.order.number);
  assert.equal(f.rows('Cotizaciones')[0].Estado,'CONVERTIDA');
  assert.equal(f.rows('Auditoria').filter(x=>x.Accion==='COTIZACION_CONVERTIR').length,1);
  assert.equal(f.run('ORDEN_CREAR',f.command).order.number,saved.order.number);
  assert.equal(f.run('COTIZACION_PREPARAR_PEDIDO',{number:f.number}).convertedOrder,saved.order.number);
  assert.equal(f.rows('Ordenes_Pedido').length,1); assert.equal(f.rows('Cotizaciones').length,1);
  assert.equal(f.rows('Remisiones').length,0); assert.equal(f.rows('Produccion').length,0);
}
for(const mutate of [p=>p.items[0].unitValue++,p=>p.items[0].photos=[],p=>p.discount++,p=>p.quoteOrigin.fingerprint='0'.repeat(64)]) {
  const f=fixture(); mutate(f.command);
  assert.throws(()=>f.run('ORDEN_CREAR',f.command),e=>e.appCode==='QUOTE_SOURCE_CHANGED');
  assert.equal(f.rows('Ordenes_Pedido').length,0); assert.equal(f.rows('Cotizaciones')[0].Convertida_OP,'');
}
{
  const f=fixture(); f.state.loseBatch=true;
  assert.throws(()=>f.run('ORDEN_CREAR',f.command),e=>e.appCode==='ORDER_SAVE_UNCERTAIN');
  const recovered=f.run('ORDEN_CREACION_ESTADO',{requestId:f.ctx.requestId});
  assert.equal(recovered.saved,true); assert.equal(f.rows('Cotizaciones')[0].Convertida_OP,recovered.order.number);
  assert.equal(f.run('ORDEN_CREAR',f.command).order.number,recovered.order.number);
  assert.equal(f.rows('Ordenes_Pedido').length,1);
}
{
  const f=fixture(); f.state.delayBatch=true;
  assert.throws(()=>f.run('ORDEN_CREAR',f.command),e=>e.appCode==='ORDER_SAVE_UNCERTAIN');
  assert.equal(f.run('ORDEN_CREACION_ESTADO',{requestId:f.ctx.requestId}).retrySameRequest,false);
  assert.equal(f.rows('Ordenes_Pedido').length,0);
}
{
  const f=fixture(); f.rows('Cotizaciones')[0].Estado='ANULADA';
  assert.throws(()=>f.run('COTIZACION_PREPARAR_PEDIDO',{number:f.number}),e=>e.appCode==='QUOTE_NOT_CONVERTIBLE');
}
assert.equal(conversionNumber('?cotizacion=MP-COT-0001'),'MP-COT-0001');
assert.throws(()=>conversionNumber('?cotizacion=bad'));
console.log('OK · conversión: origen inmutable, enlace atómico, referencias, reintentos y respuestas perdidas.');
