import assert from 'node:assert/strict';
import { handleRequest } from '../functions/api/maderarte.js';
const env={MADERARTE_APPS_SCRIPT_URL:'https://script.example/exec',MADERARTE_PROXY_TOKEN:'synthetic'},number='MP-QA-REM-0001',sandboxId='QA-'+'a'.repeat(32);
const req=(action='REMISION_DOCUMENTOS_FINALIZAR',cookie=true)=>new Request('https://app.example.com/api/maderarte',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://app.example.com',...(cookie?{Cookie:'__Host-maderarte_session=synthetic'}:{})},body:JSON.stringify({action,payload:{number,html:'UNTRUSTED',url:'https://evil.example'},sandboxId})});
let renders=0,confirmed=0,mode='ok';const calls=[],original=globalThis.fetch;
env.BROWSER={quickAction:async (kind,options)=>{renders++;assert.equal(kind,'pdf');assert.equal(options.url,'https://app.maderartepopayan.com/documento-render.html');assert.equal(options.pdfOptions.height,'5.5in');assert.ok(!options.addScriptTag[0].content.includes('UNTRUSTED'));if(mode==='render-failure')return new Response('Unavailable',{status:503});return new Response('%PDF-1.4\nsynthetic',{headers:{'content-type':'application/pdf'}});}};
try{
 globalThis.fetch=async (_url,init)=>{
  const body=JSON.parse(init.body);calls.push(body.action);assert.equal(body.sandboxId,sandboxId);assert.equal(body.proxyMeta.documentPipeline,true);
  if(mode==='denied')return Response.json({status:'error',httpStatus:403,code:'PERMISSION_DENIED',msg:'No autorizado'});
  if(body.action==='INTERNO_REMISION_DOCUMENTO_PREPARAR'){assert.deepEqual(body.payload,{number});return Response.json({status:'success',data:{number,complete:false,id:'reserved',planHash:'a'.repeat(64),document:{number,issued:true,documentKind:mode==='wrong-kind'?'receipt':'remission'}}});}
  assert.equal(body.action,'INTERNO_REMISION_DOCUMENTO_CONFIRMAR');assert.equal(body.payload.id,'reserved');assert.ok(atob(body.payload.base64).startsWith('%PDF-'));confirmed++;return Response.json({status:'success',data:{number,complete:true}});
 };
 assert.equal((await handleRequest(req(undefined,false),env)).status,401);assert.equal(renders,0);
 assert.equal((await handleRequest(req('INTERNO_REMISION_DOCUMENTO_PREPARAR'),env)).status,403);
 mode='denied';assert.equal((await handleRequest(req(),env)).status,403);assert.equal(renders,0);
 mode='wrong-kind';assert.equal((await handleRequest(req(),env)).status,503);assert.equal(renders,0);
 mode='render-failure';assert.equal((await handleRequest(req(),env)).status,503);assert.equal(confirmed,0);
 mode='ok';const result=await handleRequest(req(),env);assert.equal(result.status,200);assert.equal((await result.json()).data.complete,true);assert.equal(confirmed,1);
 assert.ok(calls.every(a=>a.startsWith('INTERNO_REMISION_DOCUMENTO_')));
}finally{globalThis.fetch=original;}
console.log('OK · remisión edge: autorización previa, plan de servidor, PDF horizontal, contexto de ensayo e internos inaccesibles.');
