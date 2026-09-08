import { apiRequest } from '../core/api.js?v=sandbox-1';
import { guardStandalonePage } from '../core/page-guard.js';
import { readSessionSnapshot } from '../core/session.js';
import { hasPermission } from '../core/permissions.js';
import { COMPANY_PROFILE } from '../core/company-profile.js';
import { APP_CONFIG } from '../core/config.js';
import { money, date, humanizeCode, escapeHtml as esc } from '../core/format.js';
import { paymentAmount } from '../core/commercial-rules.js?v=agreements-1';
import { createReceiptSave } from '../core/receipt-save.js';
import { currentSandboxId, sandboxLink, bindSandboxBanner } from '../core/order-sandbox-context.js';

const $ = id => document.getElementById(id);
let account=null, sequence=0,manager,locked=false,capabilities=false;
const receiptPath=number=>sandboxLink('/abono.html?recibo='+encodeURIComponent(number));
function action(root,label,run){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>void run());root.append(button);return button;}
function error(message){$('receipt-error').textContent=message;}
function calculate(){
  const amount=paymentAmount($('receipt-amount').value);
  $('receipt-next-balance').textContent=account && Number.isSafeInteger(amount) && amount>=0 && amount<=account.position.balance ? money(account.position.balance-amount):'Revisa el importe';
}
async function openPdf(number){
  const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
  try {const {data}=await apiRequest('RECIBO_PDF_LEER',{number},{timeoutMs:90000});
    if(data?.mime!=='application/pdf' || !data.base64)throw Error('No se pudo abrir el PDF.');
    const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    if(popup)popup.location=url;else {const a=document.createElement('a');a.href=url;a.download=data.name||number+'.pdf';a.click();}
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(failure){popup?.close();$('receipt-feedback').textContent=failure.message;}
}
async function showReceipt(number){
  $('receipt-entry').hidden=true;$('receipt-result').hidden=false;$('receipt-result').textContent='Consultando el recibo…';
  try {const {data:r}=await apiRequest('RECIBO_OBTENER',{number});
    $('receipt-result').innerHTML=`<span>Recibo registrado</span><h2>${esc(r.number)}</h2><p>${esc(r.client)}</p><p class="receipt-result-amount">${esc(money(r.amount))}</p><p>${esc(humanizeCode(r.method))} · ${esc(date(r.date))}</p><p>${esc(r.concept)}</p><p>Saldo después de este pago: <strong>${esc(money(r.balance))}</strong></p><a href="${esc(sandboxLink('/orden.html?op='+encodeURIComponent(r.orderNumber)))}">Abrir ${esc(r.orderNumber)}</a><p>${r.complete?'PDF archivado.':'Pago registrado. Su PDF está pendiente.'}</p>`;
    if(r.complete)action($('receipt-result'),'Abrir PDF',()=>openPdf(number));
    else if(capabilities)action($('receipt-result'),'Completar PDF',async()=>{try {$('receipt-feedback').textContent='Completando el PDF…';await apiRequest('RECIBO_DOCUMENTOS_FINALIZAR',{number},{timeoutMs:150000});$('receipt-feedback').textContent='';await showReceipt(number);}catch(e){$('receipt-feedback').textContent=e.message;}});
  }catch(e){$('receipt-result').textContent=e.message;action($('receipt-result'),'Volver a intentar',()=>showReceipt(number));}
}
function renderSave(state){
  locked=state.locked;$('receipt-fields').disabled=locked || !account?.canReceive || !account?.position.balance;
  $('receipt-query').disabled=locked;$('receipt-search-form').querySelector('button').disabled=locked;
  $('receipt-submit').disabled=!state.canSave || !account?.canReceive || !account?.position.balance;
  $('receipt-mode').textContent=state.phase==='disabled'?'En preparación: puedes consultar pagos y saldos. El registro aún no está habilitado.':state.phase==='ready'?'El número del recibo se asigna al confirmar el pago.':state.message;
  const root=$('receipt-recovery');root.replaceChildren();root.hidden=['disabled','ready','new'].includes(state.phase);
  if(root.hidden)return;
  root.append(document.createTextNode(state.message));
  if(state.phase==='confirmed'){
    action(root,'Abrir recibo',()=>window.location.assign(receiptPath(state.number)));
    action(root,'Nuevo abono',async()=>{const result=await manager.startNew();if(result.phase==='new')window.location.assign(sandboxLink('/abono.html'));});
  }else if(!['saving','checking'].includes(state.phase) && !state.working){
    if(state.phase==='rejected' && account)action(root,'Actualizar saldo de la orden',()=>selectOrder(account.order.number));
    action(root,'Consultar resultado',()=>manager.refresh());
    if(state.phase==='retry')action(root,'Reenviar el mismo intento',()=>manager.retry());
    if(state.phase==='documents')action(root,'Abrir recibo registrado',()=>window.location.assign(receiptPath(state.number)));
  }
  if(state.locked)$('receipt-account').hidden=true;
}
async function selectOrder(number){
  const ticket=++sequence;account=null;$('receipt-account').hidden=true;$('receipt-results').replaceChildren();$('receipt-search-status').textContent='Consultando historial y saldo…';
  try {const {data}=await apiRequest('RECIBO_CUENTA',{number});if(ticket!==sequence)return;
    account=data;$('receipt-query').value=data.order.number;$('receipt-client-name').textContent=data.order.client;
    $('receipt-order-link').href=sandboxLink('/orden.html?op='+encodeURIComponent(number));$('receipt-order-link').textContent=number;
    for(const key of ['total','paid','balance'])$('receipt-'+key).textContent=money(data.position[key]);
    const history=$('receipt-history');history.replaceChildren();
    if(!data.payments.length)history.textContent='Esta orden no tiene pagos registrados.';
    for(const p of data.payments){const row=document.createElement('div');row.className='receipt-history-row';row.innerHTML=`<div>${esc(p.number)}<small>${esc(date(p.date))} · ${esc(humanizeCode(p.method))}${p.comment?' · '+esc(p.comment):''}</small></div><div><strong>${esc(money(p.value))}</strong></div>`;action(row.lastElementChild,'Ver recibo',()=>window.location.assign(receiptPath(p.number)));history.append(row);}
    $('receipt-form').reset();$('receipt-concept').value='Abono a la orden '+number;error('');
    $('receipt-search-status').textContent=!data.canReceive?'Esta orden no admite nuevos pagos.':data.position.balance===0?'La orden no tiene saldo pendiente.':'';
    $('receipt-account').hidden=false;renderSave(manager?.getState()||{phase:'disabled',locked:false,canSave:false});calculate();
  }catch(e){if(ticket===sequence)$('receipt-search-status').textContent=e.message;}
}
async function search(){
  if(locked)return;const query=$('receipt-query').value.trim();const ticket=++sequence;account=null;$('receipt-account').hidden=true;$('receipt-results').replaceChildren();
  if(!query){$('receipt-search-status').textContent='Escribe una OP, nombre o cédula.';return;}
  $('receipt-search-status').textContent='Buscando órdenes…';
  try {const {data}=await apiRequest('ORDENES_LISTAR',{query,limit:50});if(ticket!==sequence)return;
    $('receipt-search-status').textContent=data.items.length?`${data.total} órdenes encontradas.${data.total>data.items.length?' Precisa la búsqueda para ver las demás.':''}`:'No se encontraron órdenes. Los recibos se registran sobre una OP existente.';
    for(const order of data.items){const b=action($('receipt-results'),'',()=>selectOrder(order.number));b.innerHTML=`<strong>${esc(order.number)}</strong><span>${esc(money(order.balance))}</span><small>${esc(order.client)} · ${esc(order.document)}</small>`;}
  }catch(e){if(ticket===sequence)$('receipt-search-status').textContent=e.message;}
}
guardStandalonePage({permission:'abonos.read',async render({session}){
  $('receipt-app').hidden=false;$('receipt-company').textContent=`${COMPANY_PROFILE.legalName} · NIT ${COMPANY_PROFILE.nit} · ${COMPANY_PROFILE.website}`;
  $('receipt-version').textContent=`Maderarte · Sistema Maddy · v${APP_CONFIG.version} · ${new Date().getFullYear()}`;
  bindSandboxBanner($('receipt-app'));
  const params=new URLSearchParams(window.location.search),op=params.get('op'),receipt=params.get('recibo');
  if(op){$('receipt-back').href=sandboxLink('/orden.html?op='+encodeURIComponent(op));$('receipt-back').setAttribute('aria-label','Volver a la orden');}
  $('receipt-search-form').addEventListener('submit',e=>{e.preventDefault();void search();});
  $('receipt-query').addEventListener('input',()=>{sequence++;account=null;$('receipt-account').hidden=true;$('receipt-results').replaceChildren();});
  $('receipt-amount').addEventListener('input',calculate);
  try {const {data}=await apiRequest('RECIBO_CAPACIDADES',{});capabilities=data.enabled===true;}catch(e){$('receipt-mode').textContent='No se pudo comprobar la disponibilidad. Puedes consultar las órdenes.';}
  if(hasPermission(session,'abonos.create')){try {
    manager=createReceiptSave({uid:session.profile.uid,scope:currentSandboxId(),request:apiRequest,durable:window.localStorage,temporary:window.sessionStorage,locks:window.navigator.locks,crypto:window.crypto,activeUid:()=>readSessionSnapshot()?.profile.uid||'',onState:renderSave});
    await manager.refresh();
    window.addEventListener('storage',event=>{if(event.key===manager.key)void manager.refresh();});
  }catch(e){$('receipt-mode').textContent='No se pudo asegurar la recuperación del guardado. Puedes consultar órdenes y recibos.';}}
  if(receipt)await showReceipt(receipt);else if(op && !locked)await selectOrder(op);
  $('receipt-form').addEventListener('submit',async event=>{
    event.preventDefault();if(locked || !account || !manager?.getState().canSave)return;
    const amount=paymentAmount($('receipt-amount').value),method=$('receipt-method').value,concept=$('receipt-concept').value.trim();
    if(!Number.isSafeInteger(amount)||amount<=0||amount>account.position.balance){error('Indica un valor positivo que no supere el saldo actual.');$('receipt-amount').focus();return;}
    if(!method || !concept){error('Selecciona el medio y escribe el concepto del recibo.');(!method?$('receipt-method'):$('receipt-concept')).focus();return;}
    error('');const result=await manager.save({number:account.order.number,fingerprint:account.position.fingerprint,amount,method,concept,reference:$('receipt-reference').value.trim(),internalNote:$('receipt-internal').value.trim()});
    if(result.phase==='confirmed')window.location.assign(receiptPath(result.number));
  });
}});
