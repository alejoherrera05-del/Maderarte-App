import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<div id="agenda-app" hidden></div>',{url:'https://example.invalid/agenda.html?op=TEST-OP',runScripts:'outside-only'}),w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.APP_CONFIG={version:'0.2.0'};w.escapeHtml=undefined;
w.esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
w.createRequestId=()=> 'AGENDA-DOM-REQUEST-0001';
w.guardStandalonePage=async({render})=>render({session:{profile:{uid:'TEST-USER'},permissions:['*']}});
const items=[{id:'I-1',description:'Sofá <prueba>',pending:2,revision:1},{id:'I-2',description:'Mesa',pending:1,revision:1}];
let sent=null,lost=true;
w.apiRequest=async(action,payload,options)=>{
  if(action==='AGENDA_LISTAR')return {data:{items:[],enabled:true}};
  if(action==='ORDEN_OBTENER')return {data:{order:{number:'TEST-OP',client:'Cliente de prueba'},items}};
  if(action==='AGENDA_GUARDADO_ESTADO')return {data:{saved:!!sent}};
  if(action==='AGENDA_GUARDAR'){sent={payload,options};if(lost){lost=false;throw Object.assign(Error('Sin respuesta'),{status:503});}return {data:{saved:true}};}
  throw Error(action);
};
const source=readFileSync('public/js/pages/agenda.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('await guardStandalonePage(','globalThis.finished=guardStandalonePage(');
w.eval(source);await w.finished;
assert.equal(w.document.querySelector('#ag-editor').open,true,'OP context opens editor directly');
assert.equal(w.document.querySelector('#ag-query').closest('#ag-search-area').hidden,true);
assert.equal(w.document.querySelectorAll('.ag-item').length,2);
assert.equal(w.document.querySelector('prueba'),null,'product names are escaped');
assert.equal(w.document.querySelectorAll('[type=time]').length,1);
for(const c of w.document.querySelectorAll('[type=checkbox]'))c.checked=true;
w.document.querySelector('#ag-date').value='2090-01-20';w.document.querySelector('#ag-time').value='14:30';
w.document.querySelector('#ag-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
await new Promise(r=>setTimeout(r,250));
assert.equal(sent.payload.items.length,2);assert.equal(sent.payload.time,'14:30');
assert.equal(w.document.querySelector('#ag-fields').disabled,true,'uncertain reply freezes exact payload');
assert.ok(w.sessionStorage.getItem('maddy.agenda.attempt.TEST-USER'));
assert.equal(w.document.querySelector('#ag-close').disabled,true);
w.document.querySelector('#ag-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
await new Promise(r=>setTimeout(r,250));
assert.equal(w.document.querySelector('#ag-editor').open,false);
assert.equal(w.sessionStorage.getItem('maddy.agenda.attempt.TEST-USER'),null);
assert.equal(sent.options.requestId,'AGENDA-DOM-REQUEST-0001');
dom.window.close();console.log('Agenda DOM: contextual opening, multiple selection, escaping, date and time capture and exact recovery verified.');


