import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const dom = new JSDOM(readFileSync('public/pedido.html','utf8'), {url:'https://app.example.com/pedido.html'});
const { window } = dom;
Object.assign(globalThis,{window,document:window.document});
const originalFetch = globalThis.fetch;
let requests=0;
globalThis.fetch=async()=>{requests++;throw new Error('No network in draft recovery');};
try {
  const {writeSessionSnapshot}=await import('../public/js/core/session.js');
  const session={profile:{uid:'qa-draft',email:'qa@example.com',status:'ACTIVO',branches:['MP']},permissions:['ordenes.read'],expiresAt:new Date(Date.now()+3600000).toISOString()};
  writeSessionSnapshot(session);
  const key='maderarte.form-draft.v1.qa-draft.order';
  const fields={
    'quote-client-document':'0000000001','quote-client-name':'Cliente sintético','quote-client-phone':'0000000001',
    'quote-client-alternatePhone':'0000000002','quote-notes':'Acuerdo de prueba',
    'quote-item-1-description':'Sala','quote-item-1-quantity':'1','quote-item-1-unitValue':'2000000','order-item-1-agreement':'ENTREGA_HOY',
    'quote-item-3-description':'Comedor','quote-item-3-quantity':'1','quote-item-3-unitValue':'1500000','order-item-3-agreement':'SEPARADO','order-item-3-fulfillment':'PARA_SOLICITAR',
    'order-payment-4-method':'TRANSFERENCIA','order-payment-4-amount':'2100000','order-payment-4-note':'NOTA-INTERNA-DE-PRUEBA',
    'order-allocation-1':'2000000','order-allocation-3':'100000'
  };
  window.sessionStorage.setItem(key,JSON.stringify({version:1,uid:'qa-draft',type:'order',savedAt:Date.now(),data:{
    branch:'MP',itemIds:[1,3],paymentIds:[4],photos:[],fields:[...Object.entries(fields).map(([id,value])=>({id,value})),{id:'order-allocate-payments',checked:true,value:'on'}]
  }}));
  window.sessionStorage.setItem('maderarte.form-draft.v1.other.order', JSON.stringify({version:1,uid:'other',savedAt:Date.now()}));
  await import('../public/js/pages/cotizacion.js');
  await new Promise(resolve=>setImmediate(resolve));
  const {readOrderEntry}=await import('../public/js/core/order-entry.js?v=agreements-1');
  assert.equal(document.getElementById('quote-workspace').hidden,false);
  assert.equal(document.getElementById('quote-meta-branch').textContent,'MP');
  assert.deepEqual([...document.querySelectorAll('.quote-item')].map(card=>card.dataset.itemId),['1','3']);
  assert.equal(document.getElementById('order-item-3-fulfillment').closest('[data-availability-field]').hidden,false);
  assert.equal(document.getElementById('order-payment-4-note').value,'NOTA-INTERNA-DE-PRUEBA');
  assert.equal(readOrderEntry(3500000).allocationError,'');
  assert.deepEqual(readOrderEntry(3500000).allocation.map(part=>part.balance),[0,1400000]);
  assert.doesNotMatch(JSON.stringify(readOrderEntry(3500000)),/INTERNA/);
  assert.equal(window.sessionStorage.getItem('maderarte.form-draft.v1.other.order'),null);
  document.getElementById('quote-add-item').click();
  assert.equal(document.querySelectorAll('.quote-item')[2].dataset.itemId,'4');
  assert.equal(JSON.parse(window.sessionStorage.getItem(key)).data.itemIds.length,3);
  document.getElementById('order-add-payment').click();
  assert.equal(document.querySelectorAll('[data-payment-row]')[1].dataset.paymentRow,'5');
  assert.equal(JSON.parse(window.sessionStorage.getItem(key)).data.paymentIds.length,2);
  const {bindFormDraft,clearFormDrafts}=await import('../public/js/core/form-draft.js?v=agreements-1');
  let deleted=false;
  const failingStorage={getItem:()=>null,setItem:()=>{throw new Error('quota');},removeItem:()=>{deleted=true;}};
  const failed=bindFormDraft({session,type:'order',capture:()=>({}),restore:()=>{},storage:failingStorage});
  await failed.ready; failed.changed();
  assert.ok(deleted);
  assert.match(document.getElementById('quote-draft-status').textContent,/No pudimos conservar/);
  const event=new window.Event('beforeunload',{cancelable:true});
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true,'Advierte al salir si no puede respaldar el borrador');
  clearFormDrafts();
  assert.equal(window.sessionStorage.getItem(key),null);
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(requests,0,'Restaurar no vuelve a buscar al cliente ni sobreescribe sus datos');
  console.log('OK · recupera cliente, IDs de muebles/pagos, acuerdos y distribución; aísla usuarios y advierte al fallar almacenamiento');
} finally {window.close();globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.document;}
