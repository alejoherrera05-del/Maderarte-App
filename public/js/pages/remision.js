import { apiRequest } from '../core/api.js?v=sandbox-1';
import { guardStandalonePage } from '../core/page-guard.js';
import { readSessionSnapshot } from '../core/session.js';
import { hasPermission } from '../core/permissions.js';
import { APP_CONFIG } from '../core/config.js';
import { dateTime, escapeHtml as esc } from '../core/format.js';
import { createRemissionSave } from '../core/remission-save.js';
import { currentSandboxId, sandboxLink, bindSandboxBanner } from '../core/order-sandbox-context.js';
const $=id=>document.getElementById('remission-'+id);
const path=n=>sandboxLink('/remision.html?remision='+encodeURIComponent(n));
const orderPath=n=>sandboxLink('/orden.html?op='+encodeURIComponent(n));
const key=n=>n.trim().replace(/\s+/g,' ').toLocaleUpperCase('es');
const silhouette='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/></svg>';
let account=null,manager,locked=false,capabilities=false,sequence=0;
function button(root,label,run){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>void run());root.append(b);return b;}
function renderPeople(role){
  const list=role==='transporter'?account?.people.transporters:account?.people.assistants;
  const query=key($(role).value),root=$(role+'-people');root.replaceChildren();
  for(const person of (list||[]).filter(p=>!query||key(p.name).includes(query)).slice(0,12)){
    const b=button(root,'',()=>{$(role).value=person.name;$(role+'-favorite').checked=person.favorite;if(role==='transporter'&&['PIALLERO','PROPIETARIO','OTRO'].includes(person.mode)){$('mode-person').value=person.mode;labelTransporter();}renderPeople(role);});
    b.className='rm-person';b.setAttribute('aria-pressed',String(key(person.name)===query));b.innerHTML=silhouette+`<span>${esc(person.name)}<small>${person.favorite?'★ Favorito':'Reciente'}</small></span>`;
  }
  if(!root.children.length){const p=document.createElement('p');p.className='rm-people-empty';p.textContent=query?'Este nombre se recordará al confirmar el despacho.':'Los nombres que uses aparecerán aquí.';root.append(p);}
}
function labelTransporter(){document.querySelector('label[for="remission-transporter"]').textContent=$('mode-person').value==='PIALLERO'?'Nombre del piallero':$('mode-person').value==='PROPIETARIO'?'Nombre del propietario':'Nombre del transportador';}
function selection(){return [...$('items').querySelectorAll('.rm-item')].filter(row=>row.querySelector('[type=checkbox]').checked).map(row=>({itemId:row.dataset.itemId,quantity:Number(row.querySelector('[type=number]').value)}));}
function calculate(){const selected=selection(),sum=selected.reduce((n,i)=>n+i.quantity,0);$('selection').textContent=selected.length?`${Number.isSafeInteger(sum)&&sum>0?sum:'—'} unidades seleccionadas en ${selected.length} ${selected.length===1?'mueble':'muebles'}.`:'Ningún mueble seleccionado.';}
function renderItems(){
  const root=$('items');root.replaceChildren();
  for(const [index,item] of account.position.items.entries()){
    const row=document.createElement('div'),available=item.pending>0&&!item.blocked;row.className='rm-item'+(item.pending===0?' is-complete':item.blocked?' is-blocked':'');row.dataset.itemId=item.id;
    row.innerHTML=`<input type="checkbox" id="rm-select-${index}" ${available?'':'disabled'}><label for="rm-select-${index}">${esc(item.description)}<small class="rm-item-status">${item.pending===0?'✓ Despacho completo':`${item.delivered} despachadas · ${item.pending} pendientes`}</small>${item.blocked&&item.pending?`<small>${esc(item.blocked)}</small>`:''}</label><label class="rm-quantity-label" for="rm-qty-${index}">Salen hoy<input id="rm-qty-${index}" type="number" min="1" max="${item.pending}" step="1" inputmode="numeric" disabled aria-label="Cantidad a despachar: ${esc(item.description)}"></label>`;
    const check=row.querySelector('[type=checkbox]'),qty=row.querySelector('[type=number]');
    check.addEventListener('change',()=>{qty.disabled=!check.checked;qty.required=check.checked;qty.value=check.checked?'1':'';calculate();});qty.addEventListener('input',calculate);root.append(row);
  }
  calculate();
}
function renderSave(state){
  locked=state.locked;$('fields').disabled=locked||!account?.canDeliver||!capabilities;
  $('query').disabled=locked;$('search-form').querySelector('button').disabled=locked;
  $('submit').disabled=!state.canSave||!account?.canDeliver||!account?.position.items.some(i=>i.pending>0&&!i.blocked);
  $('mode').textContent=state.phase==='disabled'?'En preparación: puedes consultar los despachos.':state.phase==='ready'?'La remisión se numera al confirmar la salida del almacén.':state.message;
  const root=$('recovery');root.replaceChildren();root.hidden=['disabled','ready','new'].includes(state.phase);
  if(root.hidden)return;root.append(document.createTextNode(state.message));
  if(state.phase==='confirmed'){
    button(root,'Abrir remisión',()=>window.location.assign(path(state.number)));
    button(root,'Nuevo despacho',async()=>{if((await manager.startNew()).phase==='new')window.location.assign(sandboxLink('/remision.html'+(account?'?op='+encodeURIComponent(account.order.number):'')));});
  }else if(!['saving','checking'].includes(state.phase)&&!state.working){
    if(state.phase==='rejected'&&account)button(root,'Actualizar cantidades',()=>selectOrder(account.order.number));
    button(root,'Consultar resultado',()=>manager.refresh());
    if(state.phase==='retry')button(root,'Reenviar el mismo intento',()=>manager.retry());
    if(state.phase==='documents')button(root,'Abrir despacho registrado',()=>window.location.assign(path(state.number)));
  }
  if(state.locked)$('account').hidden=true;
}
async function selectOrder(number){
  const ticket=++sequence;account=null;$('account').hidden=true;$('results').replaceChildren();$('search-status').textContent='Consultando cantidades y despachos…';
  try{const {data}=await apiRequest('REMISION_CUENTA',{number});if(ticket!==sequence)return;
    account=data;$('form').reset();$('query').value=number;$('client').textContent=data.order.client;$('address').textContent=[data.order.address,data.order.city].filter(Boolean).join(' · ');$('contact').textContent=[data.order.document,data.order.phone,data.order.alternatePhone].filter(Boolean).join(' · ');$('order-link').href=orderPath(number);$('order-link').textContent=number;$('dispatcher').textContent=data.dispatcher;
    for(const [label,prop] of [['total','quantity'],['dispatched','delivered'],['pending','pending']])$(label).textContent=data.position.items.reduce((n,i)=>n+i[prop],0);
    $('notes').value=data.order.notes||'';$('assistant-section').hidden=true;$('assistant').required=false;
    renderItems();labelTransporter();renderPeople('transporter');renderPeople('assistant');
    const history=$('history');history.replaceChildren();
    for(const r of [...data.position.history].reverse()){const row=document.createElement('article');row.className='rm-history-row';row.innerHTML=`<strong>${esc(r.number)}</strong><p>${esc(dateTime(r.date))} · Transporta ${esc(r.transporter.name)}</p><p>${esc(r.items.map(i=>i.quantity+' × '+i.description).join(' · '))}</p><a href="${esc(path(r.number))}">Ver remisión y PDF</a>`;history.append(row);}
    if(!history.children.length)history.textContent='Todavía no hay despachos de esta orden.';
    $('search-status').textContent=!data.canDeliver?'Esta orden no admite despachos.':data.position.items.every(i=>!i.pending)?'✓ Todos los muebles salieron del almacén.':'';
    $('account').hidden=false;$('error').textContent='';renderSave(manager?.getState()||{phase:'disabled',canSave:false,locked:false});
  }catch(e){if(ticket===sequence)$('search-status').textContent=e.message;}
}
async function search(){
  if(locked)return;const query=$('query').value.trim(),ticket=++sequence;account=null;$('account').hidden=true;$('results').replaceChildren();
  if(!query){$('search-status').textContent='Escribe una OP, nombre o cédula.';return;}$('search-status').textContent='Buscando órdenes…';
  try{const {data}=await apiRequest('ORDENES_LISTAR',{query,limit:50});if(ticket!==sequence)return;
    $('search-status').textContent=data.items.length?`${data.total} órdenes encontradas.${data.total>data.items.length?' Precisa la búsqueda para ver las demás.':''}`:'No se encontraron órdenes.';
    for(const order of data.items){const b=button($('results'),'',()=>selectOrder(order.number));b.innerHTML=`<strong>${esc(order.number)}</strong><small>${esc(order.client)} · ${esc(order.document)}</small>`;}
  }catch(e){if(ticket===sequence)$('search-status').textContent=e.message;}
}
async function openPdf(number){
  const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
  try{const {data}=await apiRequest('REMISION_PDF_LEER',{number},{timeoutMs:90000});if(data?.mime!=='application/pdf'||!data.base64)throw Error('No se pudo abrir el PDF.');
    const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))],{type:'application/pdf'}));
    if(popup)popup.location=url;else{const a=document.createElement('a');a.href=url;a.download=data.name;a.click();}setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(e){popup?.close();$('feedback').textContent=e.message;}
}
async function showRemission(number){
  $('entry').hidden=true;$('result').hidden=false;$('result').textContent='Consultando la remisión…';
  try{const {data:r}=await apiRequest('REMISION_OBTENER',{number}),d=r.document;
    $('back').href=orderPath(r.orderNumber);$('back').setAttribute('aria-label','Volver a la orden');
    $('result').innerHTML=`<span>Salida del almacén registrada</span><h2>${esc(r.number)}</h2><p>${esc(d.client.name)} · ${esc(dateTime(d.date))}</p><p>${esc(d.client.address)} · ${esc(d.client.city)}</p><ul>${d.items.map(i=>`<li>${i.quantity} × ${esc(i.description)} · ${i.pendingAfter} pendientes</li>`).join('')}</ul><p>Transporta <strong>${esc(d.transporter.name)}</strong> · ${d.transporter.mode==='PROPIETARIO'?'Propietario':d.transporter.mode==='PIALLERO'?'Piallero':'Transportador'}</p><p>${d.assistant?'Acompaña '+esc(d.assistant):'Va solo el transportador'}</p><p>Despacha <strong>${esc(d.dispatcher)}</strong></p><p>${esc(d.notes||'')}</p><a href="${esc(orderPath(r.orderNumber))}">Volver a la orden y sus pendientes</a><p>${r.complete?'PDF horizontal archivado en el expediente.':'El despacho está registrado; su PDF está pendiente.'}</p>`;
    if(r.complete)button($('result'),'Abrir PDF',()=>openPdf(number));
    else if(capabilities)button($('result'),'Completar PDF',async()=>{try{$('feedback').textContent='Generando y archivando la remisión…';await apiRequest('REMISION_DOCUMENTOS_FINALIZAR',{number},{timeoutMs:150000});$('feedback').textContent='';await showRemission(number);}catch(e){$('feedback').textContent=e.message;}});
    if(manager?.getState().phase==='confirmed')button($('result'),'Preparar otro despacho',async()=>{if((await manager.startNew()).phase==='new')window.location.assign(sandboxLink('/remision.html?op='+encodeURIComponent(r.orderNumber)));});
  }catch(e){$('result').textContent=e.message;button($('result'),'Volver a intentar',()=>showRemission(number));}
}
guardStandalonePage({permission:'remisiones.read',async render({session}){
  $('app').hidden=false;bindSandboxBanner($('app'));$('version').textContent=`Maderarte · Sistema Maddy · v${APP_CONFIG.version} · ${new Date().getFullYear()}`;
  const params=new URLSearchParams(location.search),op=params.get('op'),number=params.get('remision');if(op){$('back').href=orderPath(op);$('back').setAttribute('aria-label','Volver a la orden');}
  $('search-form').addEventListener('submit',e=>{e.preventDefault();void search();});$('query').addEventListener('input',()=>{sequence++;account=null;$('account').hidden=true;$('results').replaceChildren();});
  $('mode-person').addEventListener('change',labelTransporter);
  for(const role of ['transporter','assistant'])$(role).addEventListener('input',()=>{const person=(role==='transporter'?account?.people.transporters:account?.people.assistants)?.find(p=>key(p.name)===key($(role).value));$(role+'-favorite').checked=person?.favorite===true;renderPeople(role);});
  $('accompanied').addEventListener('change',()=>{$('assistant-section').hidden=!$('accompanied').checked;$('assistant').required=$('accompanied').checked;if($('accompanied').checked)$('assistant').focus();});
  try{capabilities=(await apiRequest('REMISION_CAPACIDADES',{})).data.enabled===true;}catch{$('mode').textContent='No se pudo comprobar la disponibilidad del registro.';}
  if(hasPermission(session,'remisiones.create'))try{
    manager=createRemissionSave({uid:session.profile.uid,scope:currentSandboxId(),request:apiRequest,durable:localStorage,temporary:sessionStorage,locks:navigator.locks,crypto:window.crypto,activeUid:()=>readSessionSnapshot()?.profile.uid||'',onState:renderSave});await manager.refresh();window.addEventListener('storage',e=>{if(e.key===manager.key)void manager.refresh();});
  }catch{$('mode').textContent='No se pudo asegurar la recuperación del despacho. Puedes consultar las remisiones.';}
  if(number)await showRemission(number);else if(op&&!locked)await selectOrder(op);
  $('form').addEventListener('submit',async e=>{
    e.preventDefault();if(locked||!account||!manager?.getState().canSave)return;
    const items=selection();
    if(!items.length||items.some(i=>!Number.isSafeInteger(i.quantity)||i.quantity<=0||i.quantity>account.position.items.find(x=>x.id===i.itemId)?.pending)){$('error').textContent='Selecciona al menos un mueble y revisa sus cantidades pendientes.';return;}
    if(!$('transporter').value.trim()||($('accompanied').checked&&!$('assistant').value.trim())||!$('physical').checked){$('error').textContent='Completa los responsables y la verificación física.';return;}
    $('error').textContent='';const result=await manager.save({number:account.order.number,fingerprint:account.position.fingerprint,items,transporter:{name:$('transporter').value.trim(),mode:$('mode-person').value,favorite:$('transporter-favorite').checked},assistant:{name:$('accompanied').checked?$('assistant').value.trim():'',favorite:$('accompanied').checked&&$('assistant-favorite').checked},notes:$('notes').value.trim(),physicalCheck:true});
    if(result.phase==='confirmed')window.location.assign(path(result.number));
  });
}});
