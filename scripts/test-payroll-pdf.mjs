import assert from 'node:assert/strict';
import {handleRequest} from '../functions/api/maderarte.js';
import {generatePayrollPdf} from '../functions/api/payroll-pdf.js';
const plan={documentKind:'payroll',number:'NOM-00001',status:'EMITIDO',revision:1};
let rendered=0,saved=0,failSave=false;
const env={MADERARTE_APPS_SCRIPT_URL:'https://script.example/exec',MADERARTE_PROXY_TOKEN:'test',BROWSER:{quickAction:async(_kind,options)=>{rendered++;assert.deepEqual(JSON.parse(options.addScriptTag[0].content),plan);return new Response('%PDF-test',{headers:{'content-type':'application/pdf'}});}}};
const req=(cookie=true,action='NOMINA_PDF')=>new Request('https://app.example.com/api/maderarte',{method:'POST',headers:{Origin:'https://app.example.com','Content-Type':'application/json',...(cookie?{Cookie:'__Host-maderarte_session=synthetic-session'}:{})},body:JSON.stringify({action,payload:{id:'NOM-TEST',document:{number:'INJECTED'},base64:'not-trusted'}})});
const original=globalThis.fetch;
try{
 assert.equal((await handleRequest(req(false),env)).status,401);assert.equal(rendered,0);
 assert.equal((await handleRequest(req(true,'INTERNO_NOMINA_PDF_GUARDAR'),env)).status,403);
 globalThis.fetch=async()=>Response.json({status:'error',code:'PERMISSION_DENIED',httpStatus:403});assert.equal((await handleRequest(req(),env)).status,403);assert.equal(rendered,0);
 globalThis.fetch=async(_url,options)=>{const b=JSON.parse(options.body);if(b.action==='INTERNO_NOMINA_PDF_DATOS'){assert.deepEqual(b.payload,{id:'NOM-TEST'});return Response.json({status:'success',data:{document:plan,hash:'verified'}});}assert.equal(b.action,'INTERNO_NOMINA_PDF_GUARDAR');assert.equal(b.payload.hash,'verified');assert.equal(atob(b.payload.base64),'%PDF-test');saved++;return Response.json(failSave?{status:'error',code:'DRIVE_FAILED',httpStatus:503}:{status:'success',data:{saved:true}});};
 const result=await handleRequest(req(),env);assert.equal(result.status,200);assert.equal((await result.json()).data.saved,true);assert.equal(saved,1);
 failSave=true;assert.equal((await handleRequest(req(),env)).status,503);
 await assert.rejects(()=>generatePayrollPdf({...env,BROWSER:{quickAction:async()=>new Response('html',{headers:{'content-type':'application/pdf'}})}},plan),/PDF inválido/);
}finally{globalThis.fetch=original;}
console.log('Payroll PDF: session and permission enforcement, internal action rejection, authoritative snapshot, private save confirmation and render failure passed.');
