import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createOrderSave } from '../public/js/core/order-save.js';
import { finalizeOrderDocuments, pdfOptions } from '../functions/api/order-documents.js';
import { handleRequest } from '../functions/api/maderarte.js';
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
const number='MP-OP-0001';
const sample={items:[{clientLineId:'1',photos:[{id:'p1',sha256:'a'.repeat(64)}]}],payments:[{amount:1,internalNote:'PRIVATE-NOTE'}],_media:[{clientLineId:'1',photoId:'p1',sha256:'a'.repeat(64),base64:'AQID'}]};
const capabilities={contractVersion:1,enabled:true,photosReady:true,documentsReady:true,mediaWorkflow:1};
for(const lost of ['upload','pdf','none']) {
 const durable=storage(),temporary=storage();let created=0,photoReady=false,pdfReady=false,failed=false,order;
 const request=async(action,payload,options)=>{
  if(action==='ORDEN_CAPACIDADES') return {data:capabilities};
  if(action==='ORDEN_CREAR'){created++;eq(payload._media,undefined);eq(payload.payments[0].internalNote,'PRIVATE-NOTE');order={requestId:options.requestId,branch:'MP',number,mediaWorkflow:1};return {data:{saved:true,order}};}
  if(action==='ORDEN_CREACION_ESTADO') return {data:{saved:true,order}};
  if(action==='ORDEN_DOCUMENTOS_ESTADO') return {data:{number,complete:pdfReady,files:[{id:'slot',itemId:number+'-I-1',clientLineId:'1',type:'FOTO',photoId:'p1',sha256:'a'.repeat(64),ready:photoReady,url:photoReady?'https://drive.google.com/file/d/qa-photo/view':''},{id:'pdf-slot',type:'OP',ready:pdfReady,url:pdfReady?'https://drive.google.com/file/d/qa-pdf/view':''}]}};
  if(action==='ORDEN_FOTO_GUARDAR'){eq(payload.id,'slot');photoReady=true;if(lost==='upload'&&!failed){failed=true;throw new Error('lost after upload');}return {data:{number,id:'slot',ready:true}};}
  if(action==='ORDEN_DOCUMENTOS_FINALIZAR'){assert(photoReady);pdfReady=true;if(lost==='pdf'&&!failed){failed=true;throw new Error('lost after PDF');}return {data:{complete:true,number}};}
  throw new Error('Unexpected '+action);
 };
 const build=()=>createOrderSave({uid:'qa',request,durable,temporary,locks:{request:async(_k,_o,f)=>f({})},crypto:webcrypto});
 const manager=build();await manager.refresh();
 eq((await manager.save(sample)).phase,lost==='none'?'confirmed':'documents');
 if(lost!=='none'){eq(JSON.parse(durable.getItem(manager.key)).stage,'documents');assert(temporary.getItem(manager.key).includes('AQID'));checks++;}
 eq((await build().refresh()).phase,'confirmed');eq(created,1);
 eq(temporary.getItem(manager.key).includes('PRIVATE-NOTE'),false);
 eq(durable.getItem(manager.key).includes('PRIVATE-NOTE'),false);
}
{
 let renders=0;const calls=[];const document={issued:true,number,client:{name:'synthetic'}};
 const env={BROWSER:{quickAction:async(kind,options)=>{
  renders++;eq(kind,'pdf');eq(options.url,'https://app.maderartepopayan.com/documento-render.html');eq(options.cacheTTL,0);
  eq(options.addScriptTag[0].type,'application/json');eq(JSON.parse(options.addScriptTag[0].content),document);
  eq(options.cookies,undefined);eq(options.authenticate,undefined);
  return new Response('%PDF-1.4\nQA\n%%EOF',{headers:{'Content-Type':'application/pdf'}});
 }}};
 const upstream=async(action,payload)=>{calls.push({action,payload});return action.endsWith('PREPARAR')?{complete:false,number,id:'pdf-slot',planHash:'f'.repeat(64),document}:{complete:true,number,pdfUrl:'https://drive.google.com/file/d/synthetic/view'};};
 eq((await finalizeOrderDocuments(number,env,upstream)).complete,true);eq(renders,1);
 eq(calls[1].action,'INTERNO_DOCUMENTO_CONFIRMAR');eq(Buffer.from(calls[1].payload.base64,'base64').toString(),'%PDF-1.4\nQA\n%%EOF');
 await finalizeOrderDocuments(number,env,async()=>({complete:true,number,pdfUrl:'same'}));eq(renders,1);
 await assert.rejects(()=>finalizeOrderDocuments(number,{},upstream),e=>e.code==='PDF_ENGINE_NOT_READY');checks++;
 const options=pdfOptions(document);for(const url of ['https://attacker.invalid/','http://127.0.0.1/','https://app.maderartepopayan.com/api/maderarte']){eq(options.allowRequestPattern.some(p=>new RegExp(p).test(url)),false);}
}
{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{}');};
 try{
  const response=await handleRequest(new Request('https://app.maderartepopayan.com/api/maderarte',{method:'POST',headers:{'Content-Type':'application/json','Cookie':'__Host-maderarte_session=synthetic'},body:JSON.stringify({action:'INTERNO_DOCUMENTO_CONFIRMAR',proxyMeta:{documentPipeline:true},payload:{}})}),{MADERARTE_APPS_SCRIPT_URL:'https://example.invalid',MADERARTE_PROXY_TOKEN:'not-real'});
  eq(response.status,403);eq(calls,0);
 }finally{globalThis.fetch=old;}
}
console.log(`OK · ${checks} comprobaciones del flujo documental: reintento, privacidad, registro único, motor PDF y frontera interna. Sin red real.`);
