import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {PAYROLL_RATES,payrollBenefitDefaults,payrollBenefitPeriods,payrollCalculate} from '../public/js/core/payroll-rules.js';
import {bindPayrollBenefitEditor,payrollBenefitEditorHtml,readPayrollBenefitEditor} from '../public/js/core/payroll-benefits-ui.js';

const employee={id:'EMP-1',name:'Luis Carlos',start:'2026-01-01',end:'2026-09-30',salary:0,transport:true,sellerUid:''};
const d=payrollBenefitDefaults('2026-09-30',employee,PAYROLL_RATES);
assert.deepEqual(d,{salary:1750905,transport:249095,benefitBase:2000000,vacationBase:1750905});
const periods=payrollBenefitPeriods('2026-01-01','2026-09-30');
assert.deepEqual(periods.prime,[{from:'2026-01-01',to:'2026-06-30',year:2026,half:'1'},{from:'2026-07-01',to:'2026-09-30',year:2026,half:'2'}]);
assert.deepEqual(periods.severance,[{from:'2026-01-01',to:'2026-09-30',year:2026}]);

const calc=payrollCalculate({type:'LIQUIDACION',from:'2026-01-01',to:'2026-09-30',vacationFrom:'2026-01-01',reviewed:true},employee,[],PAYROLL_RATES);
assert.equal(calc.lines.find(x=>x.label.includes('1er semestre')).amount,1000000);
assert.equal(calc.lines.find(x=>x.label.includes('2º semestre')).amount,500000);
assert.equal(calc.lines.find(x=>x.label.startsWith('Cesantías · 2026')).amount,1500000);
assert.equal(calc.lines.find(x=>x.label==='Intereses a las cesantías · 2026').amount,135000);
assert.equal(calc.lines.find(x=>x.label.startsWith('Vacaciones pendientes')).amount,656589);
assert.equal(calc.net,3791589);

const paidPrima=payrollCalculate({type:'LIQUIDACION',from:'2026-01-01',to:'2026-09-30',primaPeriods:[{from:'2026-01-01',to:'2026-06-30',paid:1000000},{from:'2026-07-01',to:'2026-09-30',paid:0}],vacationFrom:'2026-01-01',reviewed:true},employee,[],PAYROLL_RATES);
assert.equal(paidPrima.net,2791589);
assert(!paidPrima.coverage.some(x=>x.concept==='PRIMA'&&x.to==='2026-06-30'),'paid first-semester prima must not create duplicate coverage');
assert(paidPrima.coverage.some(x=>x.concept==='PRIMA'&&x.from==='2026-07-01'),'second-semester prima remains payable');

const dom=new JSDOM('<!doctype html><body><form id="f"><div id="slot"></div><button type="submit">Continuar</button></form></body>',{url:'https://app.example.test/nomina.html'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,Event:dom.window.Event});
const form=document.getElementById('f'),slot=document.getElementById('slot');
slot.innerHTML=payrollBenefitEditorHtml({type:'LIQUIDACION',employee,from:'2026-01-01',to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
bindPayrollBenefitEditor(form,{type:'LIQUIDACION',employee,from:'2026-01-01',to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
assert.match(form.textContent,/1er semestre 2026/);assert.match(form.textContent,/2º semestre 2026/);
assert.equal(form.elements.primeBase0.value,'2000000');assert.equal(form.elements.primeBase1.value,'2000000');
assert.equal(form.elements.sevBase0.value,'2000000');assert.equal(form.elements.vacationBase.value,'1750905');
form.querySelector('#np-prime-paid-0').click();
assert.equal(form.elements.primePaid0.value,'1000000');
assert.match(form.querySelector('[data-benefit-value="prima-0"]').textContent,/0/);
assert.doesNotMatch(form.querySelector('[data-benefit-value="prima-1"]').textContent,/^\s*\$\s*0/);
const payload=readPayrollBenefitEditor(form,{from:'2026-01-01',to:'2026-09-30'});
assert.equal(payload.primaPeriods.length,2);assert.equal(payload.primaPeriods[0].paid,1000000);assert.equal(payload.primaPeriods[1].paid,0);

const longEmployee={...employee,start:'2025-01-01'};
slot.innerHTML=payrollBenefitEditorHtml({type:'LIQUIDACION',employee:longEmployee,from:'2025-01-01',to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
bindPayrollBenefitEditor(form,{type:'LIQUIDACION',employee:longEmployee,from:'2025-01-01',to:'2026-09-30',initial:{},rates:PAYROLL_RATES,receipts:[]});
assert.equal(form.elements.vacationFrom.value,'');assert.equal(form.querySelector('button[type="submit"]').disabled,true);
form.querySelector('[data-vacation-history="none"]').click();
assert.equal(form.elements.vacationFrom.value,'2025-01-01');assert.equal(form.querySelector('button[type="submit"]').disabled,false);

dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.Event;
console.log('Payroll benefits: explicit semesters, annual cesantias, paid-first-semester handling and vacation history passed.');