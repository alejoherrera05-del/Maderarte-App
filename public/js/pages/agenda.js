import { apiRequest, createRequestId } from '../core/api.js?v=agenda-1';
import { guardStandalonePage } from '../core/page-guard.js';
import { escapeHtml as esc } from '../core/format.js';
import { APP_CONFIG } from '../core/config.js';

const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota'}).format(new Date());
const state = { date:today, month:today.slice(0,7), events:[], enabled:false, order:null, edit:null, attempt:null, key:'', busy:false };
const $ = id => document.getElementById(id);
const api = async (action,payload={},options={}) => (await apiRequest(action,payload,options)).data;
const dayName = value => new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const orderLink = number => '/orden.html?op='+encodeURIComponent(number);
const icon = name => `<img src="/assets/icons/${name}.svg" alt="">`;

function calendar() {
  const [y,m]=state.month.split('-').map(Number), first=new Date(Date.UTC(y,m-1,1)), offset=(first.getUTCDay()+6)%7, count=new Date(Date.UTC(y,m,0)).getUTCDate();
  $('ag-month').textContent=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  $('ag-days').innerHTML=Array.from({length:offset},()=>'<span></span>').join('')+Array.from({length:count},(_,n)=>{
    const date=state.month+'-'+String(n+1).padStart(2,'0');
    return `<button type="button" data-date="${date}" aria-label="${esc(dayName(date))}" aria-pressed="${date===state.date}" data-events="${state.events.some(e=>e.date===date&&e.status==='PROGRAMADA')}">${n+1}</button>`;
  }).join('');
  $('ag-days').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.date=b.dataset.date;render();}));
}
function eventCard(event) {
  const pending=event.status==='PROGRAMADA';
  return `<article class="ag-event"><div class="ag-event-top"><a href="${esc(orderLink(event.number))}">${esc(event.number)}</a><span>${esc(pending?dayName(event.date):event.status==='DESPACHADA'?'Despachada':'Programación cancelada')}</span></div><h2>${esc(event.client)}</h2><ul>${event.items.map(i=>`<li>${esc(i.description)} · ${i.remaining || i.quantity} ${i.quantity===1?'unidad':'unidades'}</li>`).join('')}</ul>${event.notes?`<p>${esc(event.notes)}</p>`:''}<div class="ag-actions">${pending?`<a class="ag-button ag-secondary" href="/remision.html?op=${encodeURIComponent(event.number)}&from=agenda">Preparar remisión</a>${state.enabled?`<button class="ag-button ag-secondary" data-edit="${esc(event.id)}">Reprogramar</button>`:''}`:''}<a href="${esc(orderLink(event.number))}">Ver OP</a></div></article>`;
}
function render() {
  calendar();$('ag-day').textContent=state.date===today?'Hoy, '+dayName(state.date):dayName(state.date);
  const selected=state.events.filter(e=>e.date===state.date);
  $('ag-list').innerHTML=selected.length?selected.map(eventCard).join(''):`<div class="ag-empty">${icon('calendar-dots')}<h2>No hay entregas para este día</h2><p>Selecciona otra fecha o programa una entrega.</p></div>`;
  const overdue=state.events.filter(e=>e.status==='PROGRAMADA'&&e.date<today);
  $('ag-overdue').innerHTML=overdue.length?`<details><summary>${overdue.length} ${overdue.length===1?'entrega pendiente':'entregas pendientes'} de días anteriores</summary>${overdue.map(eventCard).join('')}</details>`:'';
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(state.events.find(e=>e.id===b.dataset.edit))));
  $('ag-new').disabled=!state.enabled;
}
async function load() {
  $('ag-refresh').disabled=true;$('ag-notice').textContent='Consultando agenda…';
  try {const data=await api('AGENDA_LISTAR');state.events=data.items;state.enabled=data.enabled;render();$('ag-notice').textContent='';}
  catch(e){$('ag-notice').textContent=e.message;}
  finally{$('ag-refresh').disabled=false;}
}
function shell() {
  $('agenda-app').innerHTML=`<header class="ag-header"><a class="ag-round" id="ag-back" href="/index.html" aria-label="Volver al inicio">${icon('arrow-left')}</a><div class="ag-brand"><img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte"><span>Agenda</span></div><button class="ag-round" id="ag-refresh" aria-label="Actualizar agenda">${icon('arrow-clockwise')}</button></header><main class="ag-layout"><aside class="ag-calendar" aria-label="Calendario"><div class="ag-month"><button class="ag-round" id="ag-prev" aria-label="Mes anterior">‹</button><strong id="ag-month"></strong><button class="ag-round" id="ag-next" aria-label="Mes siguiente">›</button></div><div class="ag-week" aria-hidden="true">${['L','M','M','J','V','S','D'].map(d=>`<span>${d}</span>`).join('')}</div><div class="ag-days" id="ag-days"></div><button class="ag-today" id="ag-today">Ir a hoy</button></aside><section><div class="ag-heading"><div><span class="ag-eyebrow">Entregas</span><h1 id="ag-day"></h1></div><button class="ag-button" id="ag-new" disabled>+ Programar</button></div><p id="ag-notice" class="ag-notice" role="status"></p><div id="ag-overdue" class="ag-overdue"></div><div id="ag-list"></div><footer class="ag-footer">Maderarte · Maddy · v${esc(APP_CONFIG.version)}</footer></section></main><dialog class="ag-dialog" id="ag-editor" aria-labelledby="ag-title"><div class="ag-dialog-head"><h2 id="ag-title">Programar entrega</h2><button class="ag-round" id="ag-close" aria-label="Cerrar">×</button></div><div id="ag-search-area"><form class="ag-search" id="ag-search-form"><input id="ag-query" type="search" placeholder="Nombre, cédula o número de OP" aria-label="Buscar orden" required><button class="ag-button">Buscar</button></form><div class="ag-results" id="ag-results"></div></div><form id="ag-form" hidden><fieldset id="ag-fields"><p id="ag-client"></p><label for="ag-date">Fecha de entrega</label><input type="date" id="ag-date" required><fieldset><legend>Muebles de esta entrega</legend><div id="ag-items"></div></fieldset><label for="ag-notes">Indicaciones</label><textarea id="ag-notes" maxlength="1000" placeholder="Dirección acordada, transporte o detalles de la entrega"></textarea></fieldset><p id="ag-error" class="ag-notice" role="status"></p><div class="ag-actions"><button class="ag-button" id="ag-save">Guardar programación</button><button type="button" class="ag-button ag-secondary" id="ag-cancel" hidden>Cancelar programación</button></div></form></dialog>`;
  $('agenda-app').hidden=false;
  $('ag-refresh').onclick=load;
  $('ag-new').onclick=()=>openEditor();
  $('ag-close').onclick=()=>{if(!state.busy&&!state.attempt)$('ag-editor').close();};
  $('ag-editor').addEventListener('cancel',e=>{if(state.busy||state.attempt)e.preventDefault();});
  $('ag-today').onclick=()=>{state.date=today;state.month=today.slice(0,7);render();};
  for(const [id,delta] of [['ag-prev',-1],['ag-next',1]])$(id).onclick=()=>{const [y,m]=state.month.split('-').map(Number);state.month=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);render();};
  $('ag-search-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('ag-results').textContent='Buscando…';try{const data=await api('ORDENES_LISTAR',{query:$('ag-query').value,limit:30});$('ag-results').innerHTML=data.items.length?data.items.map(o=>`<button type="button" data-op="${esc(o.number)}">${esc(o.client)}<small>${esc(o.number)}</small></button>`).join(''):'No hay órdenes coincidentes.';$('ag-results').querySelectorAll('button').forEach(b=>b.onclick=()=>selectOrder(b.dataset.op));}catch(error){$('ag-results').textContent=error.message;}finally{button.disabled=false;}};
  $('ag-form').onsubmit=e=>{e.preventDefault();save(false);};
  $('ag-cancel').onclick=()=>save(true);
  window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});
}
async function openEditor(event=null,number='') {
  state.edit=event;state.order=null;$('ag-title').textContent=event?'Reprogramar entrega':'Programar entrega';$('ag-form').hidden=true;$('ag-search-area').hidden=!!(event||number);$('ag-results').textContent='';$('ag-query').value='';$('ag-error').textContent='';
  if(!$('ag-editor').open)$('ag-editor').showModal();
  if(event||number)await selectOrder(event?.number||number);
}
async function selectOrder(number) {
  $('ag-form').hidden=false;$('ag-error').textContent='Consultando muebles…';$('ag-save').disabled=true;
  try {
    const data=await api('ORDEN_OBTENER',{number});if(!data)throw Error('No se encontró la OP.');state.order=data;
    $('ag-search-area').hidden=true;$('ag-client').textContent=data.order.client+' · '+number;
    $('ag-date').value=state.edit?.date||state.date;$('ag-date').min=today;$('ag-notes').value=state.edit?.notes||'';
    const items=data.items.filter(i=>i.pending>0&&i.status!=='ANULADO');
    $('ag-items').innerHTML=items.map(i=>{const selected=state.edit?.items.find(x=>x.id===i.id);const occupied=state.events.some(e=>e.id!==state.edit?.id&&e.number===number&&e.status==='PROGRAMADA'&&e.items.some(x=>x.id===i.id&&x.remaining>0));return `<label class="ag-item"><input type="checkbox" data-id="${esc(i.id)}" ${selected?'checked':''} ${occupied?'disabled':''}><span>${esc(i.description)}<small>${occupied?'Ya tiene entrega programada':i.pending+' pendientes'}</small></span><input type="number" min="1" max="${i.pending}" step="1" value="${selected?.remaining||i.pending}" aria-label="Cantidad de ${esc(i.description)}" ${occupied?'disabled':''}></label>`;}).join('')||'<p>No quedan muebles pendientes de despacho.</p>';
    $('ag-save').disabled=!state.enabled||!items.length;$('ag-fields').disabled=false;$('ag-cancel').hidden=!state.edit;$('ag-error').textContent='';
  }catch(e){$('ag-error').textContent=e.message;}
}
async function save(cancel) {
  if(state.busy)return;
  let attempt=state.attempt;
  if(!attempt){
    const items=[...$('ag-items').querySelectorAll('.ag-item')].filter(row=>row.querySelector('[type=checkbox]').checked).map(row=>{const id=row.querySelector('[type=checkbox]').dataset.id;return {id,quantity:Number(row.querySelector('[type=number]').value),revision:state.order.items.find(i=>i.id===id).revision};});
    if(!items.length){$('ag-error').textContent='Selecciona al menos un mueble.';return;}
    if(items.some(i=>!Number.isSafeInteger(i.quantity)||i.quantity<1)){$('ag-error').textContent='Revisa las cantidades.';return;}
    attempt={requestId:createRequestId('AGENDA'),payload:{id:state.edit?.id||'',revision:state.edit?.revision||0,number:state.order.order.number,date:$('ag-date').value,items,notes:$('ag-notes').value,cancel}};
    try{sessionStorage.setItem(state.key,JSON.stringify(attempt));}catch{$('ag-error').textContent='No se pudo conservar el intento en este navegador. Libera espacio antes de guardar.';return;}
    state.attempt=attempt;
  }
  state.busy=true;$('ag-fields').disabled=true;$('ag-save').disabled=true;$('ag-cancel').disabled=true;$('ag-close').disabled=true;$('ag-error').textContent='Guardando programación…';
  try {
    const status=await api('AGENDA_GUARDADO_ESTADO',{requestId:attempt.requestId});
    if(!status.saved)await api('AGENDA_GUARDAR',attempt.payload,{requestId:attempt.requestId});
    sessionStorage.removeItem(state.key);state.attempt=null;$('ag-editor').close();state.date=attempt.payload.date;state.month=state.date.slice(0,7);await load();
  }catch(e){
    // A definite validation rejection can be edited; an uncertain write retains its exact request.
    if(e.status>=400&&e.status<500&&e.status!==408&&e.code!=='ORDER_RECOVERY_REQUIRED'){sessionStorage.removeItem(state.key);state.attempt=null;$('ag-fields').disabled=false;}
    $('ag-error').textContent=e.message;$('ag-save').textContent=state.attempt?'Comprobar y reintentar':'Guardar programación';
  }finally{state.busy=false;$('ag-save').disabled=false;$('ag-cancel').disabled=false;$('ag-close').disabled=!!state.attempt;}
}
await guardStandalonePage({permission:'agenda.read',render:async({session})=>{
  state.key='maddy.agenda.attempt.'+session.profile.uid;shell();render();await load();
  try{state.attempt=JSON.parse(sessionStorage.getItem(state.key)||'null');}catch{ $('ag-notice').textContent='No se pudo recuperar el intento anterior. Revisa la agenda antes de programar.'; }
  if(state.attempt){$('ag-editor').showModal();$('ag-search-area').hidden=true;$('ag-form').hidden=false;$('ag-fields').disabled=true;$('ag-error').textContent='Hay un guardado por confirmar. Comprueba el intento para evitar repetirlo.';$('ag-save').textContent='Comprobar y reintentar';$('ag-close').disabled=true;return;}
  const number=new URLSearchParams(location.search).get('op');if(number){$('ag-back').href=orderLink(number);$('ag-back').setAttribute('aria-label','Volver a la OP');if(state.enabled)await openEditor(null,number);}
}});

