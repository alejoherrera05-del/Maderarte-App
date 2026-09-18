import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {PAYROLL_RATES,payrollBenefitDefaults,payrollCalculate} from '../public/js/core/payroll-rules.js';
import {bindPayrollBenefitEditor,payrollBenefitEditorHtml,payrollBenefitModel} from '../public/js/core/payroll-benefits-ui.js';

const employee={id:'EMP-1',name:'Luis Carlos',start:'2026-01-01',end:'2026-09-30',salary:0,transport:true,sellerUid:''};
const d=payrollBenefitDefaults('2026-09-30',employee,PAYROLL_RATES);
assert.deepEqual(d,{salary:1750905,transport:249095,benefitBase:2000000,vacationBase:1750905,primaFrom:'2026-07-01',severanceFrom:'2026-01-01'});
const calc=payrollCalculate({type:'LIQUIDACION',from:'2026-01-01',to:'2026-09-30',vacationFrom:'2026-01-01',reviewed:true},employee,[],PAYROLL_RATES);
assert.equal(calc.lines.find(x=>x.label.startsWith('Prima de servicios')).amount,500000);
assert.equal(calc.lines.find(x=>x.label.startsWith('Cesantías ·')).amount,1500000);
assert.equal(calc.lines.find(x=>x.label==='Intereses a las cesantías').amount,135000);
assert.equal(calc.lines.find(x=>x.label.startsWith('Vacaciones pendientes')).amount,656589);
assert.equal(calc.net,2791589);
const paidPrima=payrollCalculate({type:'LIQUIDACION',from:'2026-01-01',to:'2026-09-30',vacationFrom:'2026-01-01',primaPaid:500000,reviewed:true},employee,[],PAYROLL_RATES);
assert(!paidPrima.coverage.some(x=>x.concept==='PRIMA'),'fully paid prima must not create duplicate coverage');

const dom=new JSDOM('<!doctype html><body><form id="f"><div id="slot"></div><button type="submit">Continuar</button></form></body>',{url:'https://app.example.test/nomina.html'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,Event:dom.window.Event});
const form=document.getElementById('f');
document.getElementById('slot').innerHTML=payrollBenefitEditorHtml({type:'LIQUIDACION',employee,to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
bindPayrollBenefitEditor(form,{type:'LIQUIDACION',employee,to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
assert.match(form.textContent,/Calculado por Maddy/);
assert.equal(form.elements.benefitBase.value,'2000000');
assert.equal(form.elements.severanceBase.value,'2000000');
assert.equal(form.elements.vacationBase.value,'1750905');
assert.equal(form.elements.primaFrom.value,'2026-07-01');
assert.equal(form.elements.vacationFrom.value,'2026-01-01');
form.querySelector('#np-prima-paid').click();
assert.equal(form.elements.primaPaid.value,'500000');
assert.match(form.querySelector('[data-benefit-value="prima"]').textContent,/0/);

const longEmployee={...employee,start:'2025-01-01'};
document.getElementById('slot').innerHTML=payrollBenefitEditorHtml({type:'LIQUIDACION',employee:longEmployee,to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
bindPayrollBenefitEditor(form,{type:'LIQUIDACION',employee:longEmployee,to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
assert.equal(form.elements.vacationFrom.value,'');
assert.equal(form.querySelector('button[type="submit"]').disabled,true);
form.querySelector('[data-vacation-history="none"]').click();
assert.equal(form.elements.vacationFrom.value,'2025-01-01');
assert.equal(form.querySelector('button[type="submit"]').disabled,false);

dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.Event;
console.log('Payroll benefits: automatic statutory bases, paid-prima handling and minimal vacation history passed.');