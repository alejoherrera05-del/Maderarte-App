import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="agenda-app" hidden></div>',{url:'https://example.invalid/agenda.html',runScripts:'outside-only'}),w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.matchMedia=()=>({matches:true});w.APP_CONFIG={version:'0.2.0'};w.esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');let seq=0;
w.createRequestId=()=>`AGENDA-DOM-${++seq}`;
w.guardStandalonePage=async({render})=>render({session:{profile:{uid:'TEST',branches:['MP'],mainBranch:'MP'},permissions:['agenda.read','agenda.update']}});
let events=[],saved=new Map(),sent=[],lose=true;
w.apiRequest=async(action,p,options)=>{
 if(action==='AGENDA_LISTAR')return {data:{items:events,enabled:true}};
 if(action==='AGENDA_GUARDADO_ESTADO')return {data:{saved:saved.has(p.requestId),result:saved.get(p.requestId)}};
 if(action==='AGENDA_GUARDAR'){
   sent.push(p);const result={id:p.id||options.requestId,date:p.date||events[0].date,time:p.time||'10:00',revision:(p.revision||0)+1,count:1};
   if(p.operation==='save')events=[{...p,...result,status:'PROGRAMADA',items:[],number:'',client:p.contact}];
   else events[0]={...events[0],revision:result.revision,status:p.operation==='cancel'?'CANCELADA':'PROGRAMADA'};
   saved.set(options.requestId,result);if(lose){lose=false;throw Object.assign(Error('Respuesta perdida'),{status:503});}return {data:{saved:true,result}};
 }
 throw Error(action);
};
const code=readFileSync('public/js/pages/agenda.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('await guardStandalonePage(','globalThis.finished=guardStandalonePage(');w.eval(code);await w.finished;
const $=id=>w.document.getElementById(id),wait=()=>new Promise(r=>setTimeout(r,30));
$('ag-new').click();assert.equal(w.document.querySelector('[data-kind="ENTREGA"]').disabled,true,'No order permission cannot open delivery');
w.document.querySelector('[data-kind="SERVICIO"]').click();assert.equal($('ag-task-form').hidden,false);assert.equal($('ag-search-area').hidden,true,'No OP required for service');
$('ag-task-title').value='Servicio <prueba>'; $('ag-contact').value='Entidad';$('ag-task-date').value='2092-01-31';$('ag-task-time').value='10:00';$('ag-repeat').value='3';
$('ag-task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();assert.equal(sent.length,1);assert.equal(sent[0].kind,'SERVICIO');assert.equal(sent[0].repeat,3);assert.equal($('ag-task-fields').disabled,true);assert.equal($('ag-recover').hidden,false);
$('ag-recover').click();await wait();assert.equal(sent.length,1,'Recovery consults result without repeating write');assert.equal($('ag-editor').open,false);assert.equal(w.document.querySelector('prueba'),null);
$('ag-find').value='Servicio';$('ag-find').dispatchEvent(new w.Event('input'));w.document.querySelector('[data-open]').click();$('ag-edit-event').click();await wait();assert.equal($('ag-task-title').value,'Servicio <prueba>');assert.equal($('ag-repeat-wrap').hidden,true);assert.equal($('ag-repeat').value,'1');$('ag-close').click();await wait();
w.document.querySelector('[data-open]').click();$('ag-cancel-event').click();await wait();assert.equal(events[0].status,'CANCELADA');assert.equal($('ag-undo').hidden,false);$('ag-undo').click();await wait();assert.equal(events[0].status,'PROGRAMADA');assert.equal(sent.at(-1).operation,'restore');
assert.equal(w.sessionStorage.getItem('maddy.agenda.attempt.TEST'),null);dom.window.close();console.log('General agenda DOM: permission-aware categories, save/recovery, edit prefilling, search, cancellation and undo verified.');

