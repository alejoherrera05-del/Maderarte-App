import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { currentSandboxId, sandboxRequestContext, sandboxDraftType, sandboxLink } from '../public/js/core/order-sandbox-context.js';
import { createOrderSave } from '../public/js/core/order-save.js';
import { handleRequest } from '../functions/api/maderarte.js';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
const id='QA-'+'a'.repeat(32);let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const setUrl=url=>{globalThis.window={location:{href:url,origin:new URL(url).origin}};};
setUrl('https://app.example/pedido.html');eq(currentSandboxId(),'');eq(sandboxRequestContext('ORDEN_CREAR'),{});
setUrl('https://app.example/pedido.html?prueba='+id);eq(currentSandboxId(),id);eq(sandboxRequestContext('ORDEN_CREAR'),{sandboxId:id});eq(sandboxRequestContext('AUTH_SESSION_VALIDATE'),{});eq(sandboxRequestContext('PRUEBA_LIMPIAR'),{});
eq(sandboxDraftType('order'),'order:'+id);assert.match(sandboxLink('/orden.html?op=MP-QA-OP-0001'),new RegExp('prueba='+id));checks++;
assert.throws(()=>sandboxLink('https://other.example/'));checks++;
for(const bad of ['','wrong','null']){setUrl('https://app.example/pedido.html?prueba='+bad);assert.throws(currentSandboxId);checks++;}
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const durable=storage(),temporary=storage(),common={uid:'owner',request:async()=>({data:{enabled:false}}),durable,temporary,locks:{request:async(k,opts,run)=>run({})},crypto:webcrypto};
const normal=createOrderSave(common),test=createOrderSave({...common,scope:id});eq(normal.key,'maderarte.order-save.v1.owner');eq(test.key,normal.key+'.'+id);assert.throws(()=>createOrderSave({...common,scope:'bad'}));checks++;
const originalFetch=globalThis.fetch;
try{
 const f=sandboxRuntime(),before=JSON.stringify(f.production()),calls=[];
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://script.example/exec');const body=JSON.parse(opts.body);calls.push(body);return new Response(f.c.doPost({postData:{contents:opts.body}}),{headers:{'content-type':'application/json'}});};
 const env={MADERARTE_APPS_SCRIPT_URL:'https://script.example/exec',MADERARTE_PROXY_TOKEN:'qa-proxy',BROWSER:{quickAction:async()=>new Response('%PDF-1.4\nqa\n%%EOF',{headers:{'content-type':'application/pdf'}})}};
 const request=async(action,payload={},scope)=>{
   const body={action,payload,requestId:f.ctx.requestId,...(scope!==undefined?{sandboxId:scope}:{}),proxyMeta:{documentPipeline:true},sessionToken:'forged'};
   const req=new Request('https://app.example/api/maderarte',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://app.example','Cookie':'__Host-maderarte_session=qa-session','X-Maderarte-Request':f.ctx.requestId},body:JSON.stringify(body)});
   return (await handleRequest(req,env)).json();
 };
 const start=await request('PRUEBA_INICIAR',{confirm:'CREAR PRUEBA AISLADA'});eq(start.status,'success');const sandbox=start.data.id;
 const create=await request('ORDEN_CREAR',f.command,sandbox);eq(create.status,'success');const number=create.data.order.number;
 const file=f.rows('Archivos_Orden').find(x=>x.Tipo==='FOTO');eq((await request('ORDEN_FOTO_GUARDAR',{number,id:file.Archivo_ID,base64:f.photo.toString('base64')},sandbox)).status,'success');
 eq((await request('INTERNO_DOCUMENTO_CONFIRMAR',{},sandbox)).code,'ACTION_FORBIDDEN');
 eq((await request('ORDEN_DOCUMENTOS_FINALIZAR',{number},sandbox)).status,'success');
 const internal=calls.filter(x=>x.action.startsWith('INTERNO_'));eq(internal.length,2);eq(internal.every(x=>x.sandboxId===sandbox && x.proxyMeta.documentPipeline===true),true);
 eq(calls.filter(x=>!x.action.startsWith('INTERNO_')).every(x=>!x.proxyMeta.documentPipeline),true);eq(calls.every(x=>x.sessionToken==='qa-session'),true);
 eq((await request('ORDEN_CAPACIDADES')).data.enabled,false);eq((await request('ORDEN_CAPACIDADES',{},'')).code,'SANDBOX_ACTION_FORBIDDEN');
 eq((await request('ORDEN_OBTENER',{number})).data,{});
 const after=structuredClone(f.production()),initial=JSON.parse(before);delete after.tables.Sesiones;delete initial.tables.Sesiones;eq(after,initial);
}finally{globalThis.fetch=originalFetch;delete globalThis.window;}
console.log(`OK · ${checks} comprobaciones de contexto explícito, aislamiento del navegador y Worker real con Google simulado.`);
