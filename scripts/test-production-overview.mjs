import assert from 'node:assert/strict';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
import { productionBuckets,prepareProductionEntry,filterProduction,loadProductionOverview } from '../public/js/core/production-overview-model.js';
const base={quantity:5,pending:5,delivered:0,cancelled:0,fulfillment:'PARA_SOLICITAR',agreement:'ENTREGA_POSTERIOR',tracking:{totals:{SOLICITADO:5,CONFIRMADO:4,FABRICACION:3,BODEGA:2},events:[]}};
assert.deepEqual(productionBuckets(base),[{stage:'SOLICITADO',quantity:1},{stage:'CONFIRMADO',quantity:1},{stage:'FABRICACION',quantity:1},{stage:'BODEGA',quantity:2}]);
assert.deepEqual(productionBuckets({...base,delivered:1,pending:4}).at(-1),{stage:'BODEGA',quantity:1});
assert.deepEqual(productionBuckets({...base,agreement:'SEPARADO',tracking:{totals:{BODEGA:2}}}),[{stage:'SEPARADO',quantity:3},{stage:'BODEGA',quantity:2}]);
assert.equal(productionBuckets({...base,tracking:{legacy:true}})[0].stage,'REVIEW');
assert.equal(productionBuckets({...base,tracking:null})[0].stage,'REVIEW');
assert.equal(productionBuckets({...base,cancelled:1,pending:4})[0].stage,'REVIEW');
for(let delivered=0;delivered<=5;delivered++)assert.equal(productionBuckets({...base,delivered,pending:5-delivered}).reduce((n,b)=>n+b.quantity,0),5-delivered);
const f=sandboxRuntime();f.start();f.command.items.forEach(i=>i.photos=[]);
const order=f.run('ORDEN_CREAR',f.command).order;
const readBefore=JSON.stringify([f.rows('Orden_Items'),f.rows('Abonos'),f.rows('Remisiones'),f.rows('Produccion')]);
const first=f.run('PRODUCCION_LISTAR',{limit:1});assert.equal(first.items.length,1);assert.equal(first.total,2);assert.ok(first.next);
const second=f.run('PRODUCCION_LISTAR',{limit:1,after:first.next});assert.equal(second.items.length,1);assert.equal(second.next,null);assert.notEqual(first.items[0].key,second.items[0].key);
assert.equal(JSON.stringify([f.rows('Orden_Items'),f.rows('Abonos'),f.rows('Remisiones'),f.rows('Produccion')]),readBefore,'Overview must not write commercial ledgers');
const loaded=await loadProductionOverview(async(action,payload)=>({data:f.run(action,{...payload,limit:1})}));assert.equal(loaded.entries.length,2);
const e=prepareProductionEntry({key:'x',order:{number:'MP-OP-001',client:'María',document:'123'},item:{...base,id:'x',description:'Sofá',tracking:{...base.tracking,events:[{provider:'Taller Norte',date:'2026-09-01'}]}}});
assert.equal(filterProduction([e],{query:'maria',provider:'Taller Norte',stage:'BODEGA'}).length,1);assert.equal(filterProduction([e],{query:'sofá',stage:'PENDING'}).length,0);
await assert.rejects(loadProductionOverview(async()=>({data:{items:[],total:2,next:'x'}})),/continuar/);
await assert.rejects(loadProductionOverview(async()=>({data:{items:[],total:2,next:null}})),/cambiaron/);
f.rows('Ordenes_Pedido')[0].Estado='ANULADA';assert.equal(f.run('PRODUCCION_LISTAR',{}).total,0);f.rows('Ordenes_Pedido')[0].Estado='CONFIRMADA';
// Exercise the real read routine with restricted authorization and branch scope.
const original=f.c.ptSession_;f.c.ptSession_=()=>({permissions:['ordenes.read','produccion.read'],profile:{branches:['TP']}});
assert.equal(f.c.productionOverview_({},{}).total,0);f.c.ptSession_=original;
f.c.validateSessionToken_=()=>({permissions:['ordenes.read'],profile:{branches:['MP']}});assert.throws(()=>f.c.productionOverview_({},{}));
console.log('Production overview: pagination, branch permissions, no writes, partial quantities, direct receipts, filters and incomplete reads verified.');

