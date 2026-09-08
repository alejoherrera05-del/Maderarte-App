import assert from 'node:assert/strict';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
import { createQuoteSave } from '../public/js/core/quote-save.js';
import { webcrypto } from 'node:crypto';
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);checks++;};
const bad=(run,code)=>{assert.throws(run,e=>e.appCode===code,code);checks++;};
function fixture(){
 const f=sandboxRuntime();f.start();
 const {payments,noPayment,...command}=structuredClone(f.command);
 command.items=command.items.map(({agreement,fulfillment,...item})=>item);
 return {...f,command};
}
function complete(f){
 const saved=f.run('COTIZACION_CREAR',f.command),number=saved.quote.number;
 eq(saved.quote.mediaWorkflow,1,'persisted receipt includes document workflow');
 const photo=f.rows('Archivos_Cotizacion').find(x=>x.Tipo==='FOTO');
 f.run('COTIZACION_FOTO_GUARDAR',{number,id:photo.Archivo_ID,base64:f.photo.toString('base64')});
 const plan=f.run('INTERNO_COTIZACION_DOCUMENTO_PREPARAR',{number});
 if (!plan.complete) f.run('INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR',{number,id:plan.id,planHash:plan.planHash,base64:Buffer.from('%PDF-1.4\nsynthetic transport\n%%EOF').toString('base64')});
 return {number,plan};
}
{
 const f=fixture(),before=JSON.stringify(f.production());
 eq(f.run('COTIZACION_CAPACIDADES').enabled,true);
 const calls=f.state.calls.length;f.run('COTIZACION_META',{branch:'MP'});
 eq(f.rows('Cotizaciones').length,0);eq(f.rows('Clientes').length,0);eq(f.rows('Sedes')[0].Siguiente_Cotizacion,1);
 eq(f.state.calls.slice(calls).some(x=>x.method==='post'),false,'metadata does not write');
 const {number,plan}=complete(f);assert.match(number,/^MP-QA-[A-F0-9]{8}-COT-0001$/);checks++;
 eq(f.rows('Cotizaciones').length,1);eq(f.rows('Clientes').length,1);eq(f.rows('Ordenes_Pedido').length,0);eq(f.rows('Abonos').length,0);
 eq(f.rows('Cotizaciones')[0].Total_Cotizado,3300000);eq(JSON.parse(f.rows('Cotizaciones')[0].Items_JSON).length,2);
 eq(plan.document.sandbox,f.c.osState_().id);eq(plan.document.items.map(x=>x.photos.length),[1,0]);
 const slots=JSON.stringify(f.rows('Archivos_Cotizacion'));complete(f);eq(JSON.stringify(f.rows('Archivos_Cotizacion')),slots,'retry uses same PDF/photo identities');
 eq(f.run('COTIZACION_OBTENER',{number}).number,number);eq(f.run('COTIZACION_PDF_LEER',{number}).mime,'application/pdf');
 eq(f.run('COTIZACION_DOCUMENTOS_ESTADO',{number}).complete,true);
 eq(f.rows('Carpetas_Documentales').filter(x=>x.Nombre==='00_COTIZACIONES').length,1);
 eq(f.rows('Carpetas_Documentales').some(x=>x.Nombre==='01_ORDEN_DE_PEDIDO'),false);
 bad(()=>f.run('COTIZACION_CREAR',f.command,'DIFFERENT-QUOTE-REQUEST'),'SANDBOX_ONE_QUOTE');
 const changed=structuredClone(f.command);changed.discount++;bad(()=>f.run('COTIZACION_CREAR',changed),'REQUEST_CONTENT_CHANGED');
 eq(JSON.stringify(f.production()),before);
 eq(f.c.osStatus_(f.ctx).canClean,true);eq(f.clean().state,'CERRADA');eq(JSON.stringify(f.production()),before);
}
for(const failure of ['lost','delayed']){
 const f=fixture();f.state[failure==='lost'?'loseBatch':'delayBatch']=true;
 assert.throws(()=>f.run('COTIZACION_CREAR',f.command));checks++;
 if(failure==='delayed'){
  eq(f.run('COTIZACION_CREACION_ESTADO',{requestId:f.ctx.requestId}).retrySameRequest,false);
  bad(()=>f.run('COTIZACION_CREAR',f.command),'ORDER_RECOVERY_REQUIRED');
  bad(()=>f.run('ORDEN_CREAR',sandboxRuntime().command,'SECOND-ORDER-REQUEST'),'ORDER_RECOVERY_REQUIRED');
  bad(f.clean,'ORDER_RECOVERY_REQUIRED');
  f.state.books[f.state.delayed.id]=f.state.delayed.book;
 }
 eq(f.run('COTIZACION_CREACION_ESTADO',{requestId:f.ctx.requestId}).saved,true);
 eq(f.rows('Cotizaciones').length,1);complete(f);eq(f.rows('Sedes')[0].Siguiente_Cotizacion,2);eq(f.clean().state,'CERRADA');
}
for(const [mutate,code] of [
 [p=>p.discount=-1,'QUOTE_INPUT_INVALID'],[p=>p.items[0].quantity=0,'QUOTE_INPUT_INVALID'],[p=>p.client.email='','QUOTE_INPUT_INVALID'],
 [p=>p.client.name='Real client','SANDBOX_SYNTHETIC_CLIENT_REQUIRED'],[p=>p.items[1].clientLineId='1','QUOTE_INPUT_INVALID']]){
 const f=fixture();mutate(f.command);bad(()=>f.run('COTIZACION_CREAR',f.command),code);eq(f.rows('Cotizaciones').length,0);eq(f.rows('Clientes').length,0);
}
{
 const f=fixture();f.rows('Sedes')[0].Siguiente_Cotizacion=0;bad(()=>f.run('COTIZACION_CREAR',f.command),'NUMBERING_NOT_READY');
}
{
 const f=fixture();const s=f.c.osState_();delete s.quoteSchemaVersion;f.c.osStore_(s);
 eq(f.run('COTIZACION_CAPACIDADES').enabled,false);eq(f.c.osStatus_(f.ctx).quoteReady,false);eq(f.start().id,s.id);
}
{
 const f=fixture();const before=JSON.stringify(f.production()),events=[];
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const payload={...f.command,_media:[{clientLineId:'1',photoId:'foto1',sha256:f.command.items[0].photos[0].sha256,base64:f.photo.toString('base64')}]};
 let lost=true;
 const request=async(action,p={},options={})=>{
  if(action==='COTIZACION_DOCUMENTOS_FINALIZAR'){
   const plan=f.run('INTERNO_COTIZACION_DOCUMENTO_PREPARAR',p);
   const result=f.run('INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR',{number:p.number,id:plan.id,planHash:plan.planHash,base64:Buffer.from('%PDF-1.4\nqa\n%%EOF').toString('base64')});
   if(lost){lost=false;throw Error('lost PDF response');}return {data:result};
  }
  return {data:f.run(action,p,options.requestId)};
 };
 const manager=createQuoteSave({uid:'qa-owner',scope:f.c.osState_().id,request,durable:storage(),temporary:storage(),crypto:webcrypto,locks:{request:async(k,o,run)=>run({})},onProgress:e=>events.push(e)});
 eq((await manager.save(payload)).phase,'documents');eq(events.some(e=>e.step==='verify'&&e.status==='complete'),false);
 eq((await manager.refresh()).phase,'confirmed');eq(events.at(-1).step,'verify');eq(f.rows('Cotizaciones').length,1);eq(f.rows('Archivos_Cotizacion').filter(x=>x.Tipo==='COTIZACION').length,1);
 eq(JSON.stringify(f.production()),before);
}
console.log(`OK · ${checks} quote backend/sandbox assertions using real Apps Script modules and simulated Google transport. No real Google writes.`);
