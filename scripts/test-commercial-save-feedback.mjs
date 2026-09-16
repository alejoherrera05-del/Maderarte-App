import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { createReceiptSave } from '../public/js/core/receipt-save.js';
import { createRemissionSave } from '../public/js/core/remission-save.js';
import { createEntrance } from '../public/js/core/maddy-entrance.js';
import { createOrderFlow, orderReturnPath } from '../public/js/core/order-flow-context.js';
import { renderSaveFeedback } from '../public/js/core/commercial-save-feedback.js';
import { money, date, humanizeCode, escapeHtml as esc } from '../public/js/core/format.js';

const ready={enabled:true,contractVersion:1,photosReady:true,documentsReady:true};
const gate=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};

for(const [make,prefix,kind] of [[createReceiptSave,'RECIBO','receipt'],[createRemissionSave,'REMISION','remission']]) {
  const wait=gate(), states=[],calls=[],durable=storage(),temporary=storage();
  let pdfFail=true, saved;
  const request=async(action,payload,options)=>{
    calls.push(action);
    if(action===prefix+'_CAPACIDADES'){await wait.promise;return {data:ready};}
    if(action===prefix+'_CREAR'){saved={requestId:options.requestId,number:'MP-'+prefix+'-001',branch:'MP'};return {data:{saved:true,[kind]:saved}};}
    if(action===prefix+'_DOCUMENTOS_FINALIZAR'){if(pdfFail)throw Error('PDF timeout');return {data:{number:saved.number,complete:true}};}
    if(action===prefix+'_OBTENER')return {data:{number:saved.number,complete:true}};
    throw Error(action);
  };
  const manager=make({uid:'synthetic',request,durable,temporary,locks:{request:async(k,o,fn)=>fn({})},crypto:webcrypto,onState:s=>states.push(s)});
  const pending=manager.save({amount:100});
  assert.equal(manager.getState().phase,'preparing','feedback before capability reply');
  assert.equal(manager.getState().canSave,false);
  await manager.save({amount:999});assert.deepEqual(calls,[prefix+'_CAPACIDADES'],'second click cannot create');
  wait.resolve();assert.equal((await pending).phase,'documents');
  assert.equal(states.at(-1).working,false);assert.match(states.at(-1).message,/registrad/);
  assert(!states.some(s=>s.phase==='confirmed'),'PDF failure must not claim success');
  pdfFail=false;assert.equal((await manager.refresh()).phase,'confirmed');
  assert.equal(calls.filter(a=>a===prefix+'_CREAR').length,1,'PDF recovery does not duplicate record');
  assert(states.some(s=>s.working&&/Verificando/.test(s.message)),'verification is an actual stage');
}

// Execute the real page controller against its real HTML with an isolated API.
const dom=new JSDOM(readFileSync(new URL('../public/abono.html',import.meta.url),'utf8'),{url:'https://app.example.invalid/abono.html?op=MP-OP-001&item=sofa'});
const {window}=dom, {document}=window;window.scrollTo=()=>{};
Object.assign(globalThis,{window,document,requestAnimationFrame:fn=>fn()});
let rendering;const caps=gate();const account={order:{number:'MP-OP-001',client:'Cliente de muestra'},position:{total:100,paid:0,balance:100,fingerprint:'sample'},payments:[],canReceive:true};
const ctx={window,document,URLSearchParams,setTimeout,clearTimeout,createEntrance,createOrderFlow,orderReturnPath,renderSaveFeedback,createReceiptSave,money,date,humanizeCode,esc,
  APP_CONFIG:{version:'test'},hasPermission:()=>false,currentSandboxId:()=>'',sandboxLink:p=>p,bindSandboxBanner:()=>{},paymentAmount:Number,
  guardStandalonePage:({render})=>{rendering=render({session:{}});},apiRequest:async action=>{if(action==='RECIBO_CAPACIDADES'){await caps.promise;return {data:ready};}if(action==='RECIBO_CUENTA')return {data:account};throw Error(action);}};
vm.runInNewContext(readFileSync(new URL('../public/js/pages/abono.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),ctx);
assert(document.getElementById('receipt-cover').hidden,'OP entry skips curtain before network returns');
assert(!document.getElementById('receipt-workflow').hidden);
assert.match(document.querySelector('.order-flow-status').textContent,/saldo y abonos/);
caps.resolve();await rendering;
assert(!document.getElementById('receipt-account').hidden);
assert.equal(document.getElementById('receipt-back').getAttribute('href'),'/orden.html?op=MP-OP-001&item=sofa');
vm.runInNewContext("renderSave({phase:'preparing',locked:true,canSave:false,working:true,message:'Comprobando…'});",ctx);
assert(!document.getElementById('receipt-account').hidden,'save retains order context');
assert(document.getElementById('receipt-fields').disabled);
assert.equal(document.querySelectorAll('.commercial-save-steps li').length,3);
assert.equal(document.getElementById('receipt-submit').textContent,'Preparando…');
assert.equal(document.querySelectorAll('.commercial-save-steps [data-complete]').length,0);
vm.runInNewContext("renderSave({phase:'documents',locked:true,canSave:false,working:true,number:'MP-RC-001',message:'Generando PDF…'});",ctx);
assert.equal(document.querySelectorAll('.commercial-save-steps [data-complete]').length,2);
assert.equal(document.getElementById('receipt-mode').textContent,'','no repeated status sentence');
dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.requestAnimationFrame;
console.log('OK · direct OP entry, preserved form, immediate feedback, double-click lock, PDF failure and recovery without duplicate receipts/remissions. Synthetic API only.');
