import assert from 'node:assert/strict';
import {handleRequest} from '../functions/api/maderarte.js';
import {generateWarrantyPdf} from '../functions/api/warranty-pdf.js';
const id='WARRANTY-TEST-0001',plan={documentKind:'warranty',issued:true,number:id,type:'RECEPCION'};
let rendered=0;const env={MADERARTE_APPS_SCRIPT_URL:'https://script.example/exec',MADERARTE_PROXY_TOKEN:'test',BROWSER:{quickAction:async(_kind,opts)=>{rendered++;assert.deepEqual(JSON.parse(opts.addScriptTag[0].content),plan);assert.equal(opts.pdfOptions.width,'8.5in');return new Response('%PDF-test',{headers:{'content-type':'application/pdf'}});}}};
const req=(cookie=true)=>new Request('https://app.example.com/api/maderarte',{method:'POST',headers:{Origin:'https://app.example.com','Content-Type':'application/json',...(cookie?{Cookie:'__Host-maderarte_session=qa-session'}:{})},body:JSON.stringify({action:'GARANTIA_PDF',payload:{id,document:{number:'INJECTED'},url:'https://evil.example'}})});
const original=globalThis.fetch;
try{
 assert.equal((await handleRequest(req(false),env)).status,401);assert.equal(rendered,0);
 globalThis.fetch=async(_u,o)=>{const b=JSON.parse(o.body);assert.equal(b.action,'GARANTIA_COMPROBANTE_DATOS');assert.deepEqual(b.payload,{id});return Response.json({status:'error',code:'PERMISSION_DENIED',httpStatus:403});};
 assert.equal((await handleRequest(req(),env)).status,403);assert.equal(rendered,0);
 globalThis.fetch=async()=>Response.json({status:'success',data:plan});const r=await handleRequest(req(),env);assert.equal(r.status,200);assert.equal(atob((await r.json()).data.base64),'%PDF-test');
 await assert.rejects(()=>generateWarrantyPdf({...env,BROWSER:{quickAction:async()=>new Response('html',{headers:{'content-type':'application/pdf'}})}},plan),e=>e.code==='PDF_RENDER_FAILED');
}finally{globalThis.fetch=original;}
console.log('Warranty PDF: authorized server snapshot only, browser data ignored, half-letter and invalid bytes rejected.');

