import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const commonMode = process.argv.includes('common');
const currentMode = process.argv.includes('current');
const hasRemoved = commonMode || currentMode;
const dom = new JSDOM(readFileSync('public/pedido.html','utf8'), {url:'https://app.example.com/pedido.html'});
const { window } = dom;
Object.assign(globalThis,{window,document:window.document});
const originalFetch = globalThis.fetch;
let requests=0;
globalThis.fetch=async()=>{requests++;throw new Error('No network in draft recovery');};
try {
  const {legacyItemPurpose}=await import('../public/js/core/order-agreements.js?v=item-purpose-1');
  assert.equal(legacyItemPurpose('ENTREGA_POSTERIOR','PARA_SOLICITAR').purpose,'PARA_SOLICITAR');
  assert.equal(legacyItemPurpose('ENTREGA_POSTERIOR','POR_DEFINIR').purpose,'','Una opción ambigua exige elegir de nuevo');
  assert.match(legacyItemPurpose('ENTREGA_POSTERIOR','DISPONIBLE').note,/entrega posterior/);
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
  if (commonMode) Object.assign(fields, {'order-common-agreement':'SEPARADO','order-common-fulfillment':'DISPONIBLE','order-item-1-agreement':'SEPARADO','order-item-1-fulfillment':'DISPONIBLE'});
  const extra = hasRemoved ? {agreementModes:{'1':'inherit','3':'custom'},removedItems:[{id:9,index:1,fields:{description:'Silla recuperada',quantity:'2',unitValue:'50000',fabric:'Tela de prueba'},detailsOpen:true,photos:[{dataUrl:'data:image/png;base64,iVBORw0KGgo='}],agreement:{mode:'custom',agreement:'ENTREGA_HOY',fulfillment:'DISPONIBLE'},allocation:'50000'}]} : {};
  if (currentMode) {
    fields['order-item-1-purpose'] = 'ENTREGA_INMEDIATA';
    fields['order-item-3-purpose'] = 'SEPARADO';
    fields['quote-notes'] = 'Texto original.\n\nCon otro párrafo.';
    extra.removedItems[0].fields.purpose = 'PARA_SOLICITAR';
    delete extra.agreementModes;
  }
  window.sessionStorage.setItem(key,JSON.stringify({version:1,uid:'qa-draft',type:'order',savedAt:Date.now(),data:{
    ...extra,branch:'MP',itemIds:[1,3],paymentIds:[4],photos:[],fields:[...Object.entries(fields).map(([id,value])=>({id,value})),{id:'order-allocate-payments',checked:true,value:'on'}]
  }}));
  window.sessionStorage.setItem('maderarte.form-draft.v1.other.order', JSON.stringify({version:1,uid:'other',savedAt:Date.now()}));
  await import('../public/js/pages/cotizacion.js');
  await new Promise(resolve=>setImmediate(resolve));
  const {readOrderEntry}=await import('../public/js/core/order-entry.js?v=agreements-1');
  assert.equal(document.getElementById('quote-workspace').hidden,false);
  assert.equal(document.getElementById('quote-meta-branch').textContent,'MP');
  assert.deepEqual([...document.querySelectorAll('.quote-item')].map(card=>card.dataset.itemId),['1','3']);
  assert.equal(document.getElementById('order-item-3-purpose').value, 'SEPARADO');
  assert.equal(document.getElementById('order-allocate-payments'),null);
  assert.equal(document.getElementById('order-payment-4-note').value,'NOTA-INTERNA-DE-PRUEBA');
  assert.equal(readOrderEntry(3500000).error,'');
  assert.equal(readOrderEntry(3500000).paid,2100000);
  assert.equal(readOrderEntry(3500000).balance,1400000);
  assert.equal(readOrderEntry(3500000).allocation,undefined);
  assert.doesNotMatch(JSON.stringify(readOrderEntry(3500000)),/INTERNA/);
  assert.equal(window.sessionStorage.getItem('maderarte.form-draft.v1.other.order'),null);
  assert.equal(document.getElementById('order-item-1-purpose').value, commonMode ? 'SEPARADO' : 'ENTREGA_INMEDIATA');
  if (currentMode) assert.equal(document.getElementById('quote-notes').value,fields['quote-notes'],'No cambia el texto de un borrador actual');
  else assert.match(document.getElementById('quote-notes').value,/Comedor: separado; requiere fábrica/,'Conserva detalles anteriores en observaciones');
  document.getElementById('quote-add-item').click();
  assert.equal(document.querySelectorAll('.quote-item')[2].dataset.itemId,hasRemoved ? '10' : '4', 'No reutiliza IDs de muebles eliminados');
  if (hasRemoved) {
    document.querySelector('[data-undo-item]').click();
    assert.deepEqual([...document.querySelectorAll('.quote-item')].map(card=>card.dataset.itemId),['1','9','3','10']);
    assert.equal(document.getElementById('quote-item-9-fabric').value,'Tela de prueba');
    assert.equal(document.querySelector('[data-item-id="9"] details').open,true);
    assert.equal(document.querySelectorAll('[data-item-id="9"] [data-photo-list] img').length,1);
    assert.equal(document.getElementById('order-allocation-9'),null);
    assert.equal(document.getElementById('order-item-9-purpose').value,currentMode ? 'PARA_SOLICITAR' : 'ENTREGA_INMEDIATA');
    assert.equal(document.getElementById('order-payment-4-amount').value,'2100000');
  }
  assert.equal(JSON.parse(window.sessionStorage.getItem(key)).data.itemIds.length,hasRemoved ? 4 : 3);
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
  console.log('OK · recupera cliente, IDs de muebles/pagos, elección por mueble y pagos generales; aísla usuarios y advierte al fallar almacenamiento');
} finally {window.close();globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.document;}
