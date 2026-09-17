import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {hidePayrollFeedback,payrollLoadingPanel,showPayrollProgress,showPayrollSuccess} from '../public/js/core/payroll-feedback.js';

const dom=new JSDOM('<!doctype html><body><div id="root"><dialog id="np-dialog"><div id="np-body"></div></dialog></div></body>',{url:'https://app.example.test/nomina.html'});
const {window}=dom,{document}=window;
Object.assign(globalThis,{window,document,requestAnimationFrame:fn=>fn()});
window.matchMedia=()=>({matches:true});

const root=document.getElementById('root');
const dialog=document.getElementById('np-dialog');
dialog.showModal=()=>{dialog.setAttribute('open','');};
dialog.close=()=>{dialog.removeAttribute('open');};
dialog.showModal();

showPayrollProgress(root,{title:'Creando comprobante',detail:'Validando el cálculo y guardando el registro.'});
let feedback=root.querySelector('#np-operation-feedback');
assert(feedback,'feedback exists immediately');
assert.equal(feedback.parentElement,dialog,'feedback stays above the active modal');
assert.equal(feedback.dataset.state,'working');
assert.equal(feedback.hidden,false);
assert.equal(feedback.querySelector('.np-operation-title').textContent,'Creando comprobante');

const done=showPayrollSuccess(root,{title:'Comprobante listo',detail:'Todo quedó guardado.',holdMs:1});
assert.equal(feedback.dataset.state,'success');
assert.equal(feedback.querySelector('.np-operation-title').textContent,'Comprobante listo');
await done;
assert.equal(feedback.hidden,true,'success feedback closes after confirmation');

const loading=payrollLoadingPanel('Preparando tu nómina','Organizando trabajadores y pagos.');
assert.match(loading,/Preparando tu nómina/);
assert.match(loading,/np-loading-ring/);

showPayrollProgress(root,{title:'Guardando',detail:'Un momento'});
hidePayrollFeedback(root);
assert.equal(feedback.hidden,true);

dom.window.close();
delete globalThis.window;delete globalThis.document;delete globalThis.requestAnimationFrame;
console.log('Payroll feedback: immediate progress, modal-safe overlay, animated success state and inline loading panel passed.');
