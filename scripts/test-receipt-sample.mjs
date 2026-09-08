import assert from 'node:assert/strict';
import { handleRequest } from '../functions/api/maderarte.js';
import { pdfOptions } from '../functions/api/order-documents.js';
import { receiptSample } from '../functions/api/receipt-sample.js';
const options=pdfOptions(receiptSample());
assert.equal(options.pdfOptions.width,'8.5in');assert.equal(options.pdfOptions.height,'5.5in');assert.equal(options.pdfOptions.format,undefined);
assert.equal(pdfOptions({documentKind:'order'}).pdfOptions.format,'a4');
const env={MADERARTE_APPS_SCRIPT_URL:'https://script.example/exec',MADERARTE_PROXY_TOKEN:'secret'};
const req=cookie=>new Request('https://app.example.com/api/maderarte',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://app.example.com',...(cookie?{Cookie:'__Host-maderarte_session=sample-session'}:{})},body:JSON.stringify({action:'RECIBO_MUESTRA_PDF',payload:{number:'INJECTED',client:{name:'PRIVATE'},url:'https://evil.example'},sandboxId:'IGNORED'})});
let rendered=0,calls=[];env.BROWSER={quickAction:async (kind,opts)=>{rendered++;assert.equal(kind,'pdf');assert.deepEqual(JSON.parse(opts.addScriptTag[0].content),receiptSample());return new Response('%PDF-sample',{headers:{'content-type':'application/pdf'}});}};
const original=globalThis.fetch;
try{
 assert.equal((await handleRequest(req(false),env)).status,401);assert.equal(rendered,0);
 globalThis.fetch=async (_url,init)=>{const body=JSON.parse(init.body);calls.push(body.action);assert.equal(body.action,'RECIBO_CAPACIDADES');assert.deepEqual(body.payload,{});assert.equal(body.sandboxId,undefined);return Response.json({status:'error',code:'PERMISSION_DENIED',httpStatus:403});};
 assert.equal((await handleRequest(req(true),env)).status,403);assert.equal(rendered,0);
 globalThis.fetch=async (_url,init)=>{calls.push(JSON.parse(init.body).action);return Response.json({status:'success',data:{enabled:false}});};
 const response=await handleRequest(req(true),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.data.sample,true);assert.equal(atob(body.data.base64),'%PDF-sample');assert.equal(rendered,1);
 assert.ok(calls.every(action=>action==='RECIBO_CAPACIDADES'));
}finally{globalThis.fetch=original;}
console.log('OK · muestra fija autenticada, media carta horizontal, sin escrituras ni datos aportados por cliente.');
