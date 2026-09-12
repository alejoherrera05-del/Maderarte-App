import { apiRequest, createRequestId } from '../core/api.js?v=agenda-1';
import { guardStandalonePage } from '../core/page-guard.js';
import { escapeHtml as esc } from '../core/format.js';
import { APP_CONFIG } from '../core/config.js';
import { attachAgendaSwipe } from '../core/agenda-swipe.js?v=agenda-6';

const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota'}).format(new Date());
const kinds={ENTREGA:{label:'Entregas',single:'Entrega',icon:'truck'},PROVEEDOR:{label:'Proveedores',single:'Pago a proveedor',icon:'wallet'},IMPUESTO:{label:'Impuestos',single:'Impuesto',icon:'file-text'},SERVICIO:{label:'Servicios',single:'Servicio',icon:'house'},GARANTIA:{label:'Garantías',single:'Garantía',icon:'clipboard-text'}};
const state={date:today,month:today.slice(0,7),events:[],enabled:false,loaded:false,filter:'',query:'',archive:false,expanded:false,edit:null,order:null,kind:'ENTREGA',busy:false,attempt:null,key:'',session:null,undo:null};
const $=id=>document.getElementById(id);
const api=async(action,payload={},options={})=>(await apiRequest(action,payload,options)).data;
const dayName=value=>new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const hourName=value=>value?new Intl.DateTimeFormat('es-CO',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(new Date('2000-01-01T'+value+':00Z')):'Hora por definir';
const orderLink=number=>'/orden.html?op='+encodeURIComponent(number);
const icon=name=>`<img src="/assets/icons/${name}.svg" alt="">`;
const type=e=>e.kind||'ENTREGA';
const pending=e=>e.status==='PROGRAMADA';
const canOrders=()=>state.session.permissions.includes('*')||state.session.permissions.includes('ordenes.read');
const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let disposeSwipes=[],inlineId='';
async function closeDialog(id){const d=$(id);if(!d.open)return;if(!reduced()){d.classList.add('ag-closing');await new Promise(r=>setTimeout(r,180));}d.close();d.classList.remove('ag-closing');}
function calendar(){
  const [y,m]=state.month.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),offset=(first.getUTCDay()+6)%7,count=new Date(Date.UTC(y,m,0)).getUTCDate();
  $('ag-month').textContent=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const selected=state.date.slice(0,7)===state.month?Number(state.date.slice(-2)):1,week=Math.floor((offset+selected-1)/7);
  $('ag-days').innerHTML=Array.from({length:offset},(_,i)=>`<span class="${Math.floor(i/7)!==week?'ag-other-week':''}"></span>`).join('')+Array.from({length:count},(_,n)=>{
    const date=state.month+'-'+String(n+1).padStart(2,'0');return `<button type="button" class="${Math.floor((offset+n)/7)!==week?'ag-other-week':''}" data-date="${date}" aria-label="${esc(dayName(date))}" aria-pressed="${date===state.date}" data-events="${state.events.some(e=>e.date===date&&pending(e))}">${n+1}</button>`;
  }).join('');
  $('ag-days').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.allPending=false;state.date=b.dataset.date;render();});
  $('ag-calendar').classList.toggle('ag-expanded',state.expanded);$('ag-expand').textContent=state.expanded?'Ver semana':'Ver mes completo';$('ag-expand').setAttribute('aria-expanded',state.expanded);
}
function eventCard(e){
  const k=kinds[type(e)]||kinds.ENTREGA,closed=!pending(e),title=type(e)==='ENTREGA'?e.client:e.title;
  const subtitle=type(e)==='ENTREGA'?`${e.number} · ${e.items.length} ${e.items.length===1?'mueble':'muebles'}`:e.contact||e.client||'';
  const status=e.status==='CANCELADA'?'Cancelado':e.status==='COMPLETADA'?'Realizado':e.status==='DESPACHADA'?'Despachada':'';
  const task=type(e)!=='ENTREGA',done=e.status==='COMPLETADA',mutable=state.enabled&&!state.busy&&!state.attempt;
  return `<article class="ag-swipe ${closed?'ag-settled':''} ${done?'ag-done':''}" data-id="${esc(e.id)}" aria-label="${esc(title)}">${pending(e)&&state.enabled?`<button class="ag-swipe-action" data-delete="${esc(e.id)}" aria-label="Eliminar ${esc(title)}" tabindex="-1" aria-hidden="true">${icon('trash')}<span>Eliminar</span></button>`:''}<div class="ag-event-surface">${task&&e.status!=='CANCELADA'?`<button type="button" class="ag-check" data-complete="${esc(e.id)}" role="checkbox" aria-checked="${done}" aria-label="${done?'Volver a pendiente':'Marcar realizado'}: ${esc(title)}" ${!mutable?'disabled':''}><span>${icon('check')}</span></button>`:`<span class="ag-row-kind">${icon(k.icon)}</span>`}<button class="ag-event" data-open="${esc(e.id)}" type="button"><span class="ag-event-copy"><strong>${esc(title)}</strong><span class="ag-event-meta"><span class="ag-category-dot ag-${type(e).toLowerCase()}"></span>${esc(k.single)}${status?' · '+status:''}${e.series?`<span class="ag-series" aria-label="Serie mensual">↻</span>`:''}</span>${subtitle?`<span class="ag-subtitle">${esc(subtitle)}</span>`:''}</span><time datetime="${esc(e.date)}T${esc(e.time||'00:00')}">${esc(hourName(e.time))}<small>${esc(dayName(e.date))}</small></time>${icon('caret-right')}</button>${pending(e)&&state.enabled?`<button class="ag-row-delete" data-delete="${esc(e.id)}" aria-label="Eliminar ${esc(title)}" ${!mutable?'disabled':''}>${icon('trash')}</button>`:''}</div></article>`;
}
function bindCards(){
  const find=id=>state.events.find(e=>e.id===id);
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDetail(find(b.dataset.open)));
  document.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>{const e=find(b.dataset.complete);changeStatus(e,e.status==='COMPLETADA'?'reopen':'complete',true);});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>changeStatus(find(b.dataset.delete),'cancel',true));
  document.querySelectorAll('.ag-swipe').forEach(row=>disposeSwipes.push(attachAgendaSwipe(row,{enabled:()=>state.enabled&&!state.busy&&!state.attempt&&pending(find(row.dataset.id)),remove:()=>changeStatus(find(row.dataset.id),'cancel',true),reduced})));
}
function render(){
  disposeSwipes.forEach(dispose=>dispose());disposeSwipes=[];
  calendar();$('ag-day').textContent=state.query?'Resultados':state.allPending?'Pendientes hasta hoy':state.date===today?'Hoy, '+dayName(state.date):dayName(state.date);
  const matches=e=>(!state.filter||type(e)===state.filter)&&(!state.query||[e.title,e.client,e.contact,e.number,e.notes].join(' ').toLocaleLowerCase('es').includes(state.query));
  const selected=state.events.filter(e=>matches(e)&&(state.query||state.allPending&&e.date<=today||e.date===state.date)&&(state.archive||pending(e)));
  $('ag-list').innerHTML=!state.loaded?'<div class="ag-empty"><h2>Cargando compromisos…</h2></div>':selected.length?selected.map(eventCard).join(''):`<div class="ag-empty">${icon('calendar-dots')}<h2>${state.query?'Sin coincidencias':'Sin compromisos pendientes'}</h2><p>${state.query?'Prueba con otro nombre o referencia.':'Este día está libre.'}</p></div>`;
  const overdue=state.events.filter(e=>pending(e)&&e.date<today&&matches(e));
  $('ag-overdue').innerHTML=!state.query&&!state.allPending&&overdue.length?`<details><summary>${overdue.length} pendientes anteriores ${icon('caret-down')}</summary>${overdue.map(eventCard).join('')}</details>`:'';
  const count=state.events.filter(e=>pending(e)&&e.date===state.date).length;$('ag-count').textContent=count?`${count} ${count===1?'compromiso':'compromisos'}`:'Agenda del almacén';
  $('ag-new').disabled=!state.enabled;$('ag-archive').setAttribute('aria-pressed',state.archive);
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.filter===state.filter));bindCards();
}
async function load(){
  $('ag-refresh').disabled=true;$('ag-notice').textContent='Actualizando agenda…';
  try{const d=await api('AGENDA_LISTAR');state.events=d.items;state.enabled=d.enabled;state.loaded=true;render();$('ag-notice').textContent='';return true;}
  catch(e){$('ag-notice').textContent=e.message;return false;}finally{$('ag-refresh').disabled=false;}
}
function shell(){
  $('agenda-app').innerHTML=`<header class="ag-header"><a class="ag-round" id="ag-back" href="/index.html" aria-label="Volver al inicio">${icon('arrow-left')}</a><div class="ag-brand"><img class="ag-seal" src="/assets/brand/maderarte-logo-2026.webp" alt=""><img class="ag-wordmark" src="/assets/brand/maderarte-wordmark-algerian.png" alt="Maderarte"><span>Agenda</span></div><button class="ag-round" id="ag-refresh" aria-label="Actualizar agenda">${icon('arrow-clockwise')}</button></header>
  <main class="ag-layout"><aside class="ag-calendar" id="ag-calendar" aria-label="Calendario"><div class="ag-month"><button class="ag-round" id="ag-prev" aria-label="Mes anterior">${icon('arrow-left')}</button><strong id="ag-month"></strong><button class="ag-round" id="ag-next" aria-label="Mes siguiente">${icon('arrow-right')}</button></div><div class="ag-week" aria-hidden="true">${['L','M','M','J','V','S','D'].map(d=>`<span>${d}</span>`).join('')}</div><div class="ag-days" id="ag-days"></div><div class="ag-calendar-actions"><button id="ag-today">Hoy</button><button id="ag-expand" aria-expanded="false">Ver mes completo</button></div><div class="ag-calendar-signature"><img src="/assets/brand/maderarte-wordmark-algerian.png" alt=""><span>Agenda del almacén</span></div></aside>
  <section class="ag-content"><div class="ag-heading"><div><span class="ag-eyebrow" id="ag-count"></span><h1 id="ag-day"></h1></div><button class="ag-button" id="ag-new" disabled>Nuevo compromiso</button></div><div class="ag-toolbar"><label class="ag-find">${icon('magnifying-glass')}<input type="search" id="ag-find" placeholder="Buscar en la agenda" aria-label="Buscar en toda la agenda"></label><button id="ag-archive" class="ag-quiet" aria-pressed="false">Ver cerrados</button></div><nav class="ag-filters" aria-label="Tipo de compromiso"><button data-filter="" aria-pressed="true">Todo</button>${Object.entries(kinds).map(([id,k])=>`<button data-filter="${id}" aria-pressed="false">${k.label}</button>`).join('')}</nav><p id="ag-notice" class="ag-notice" role="status"></p><button id="ag-list-recover" class="ag-button" hidden>Comprobar guardado</button><div id="ag-overdue" class="ag-overdue"></div><div id="ag-list"></div><footer class="ag-footer">Maderarte · Maddy · v${esc(APP_CONFIG.version)} · ${new Date().getFullYear()}</footer></section></main>
  <div class="ag-toast" id="ag-toast" hidden role="status"><span id="ag-toast-text"></span><button id="ag-undo">Deshacer</button><button id="ag-toast-close" aria-label="Cerrar aviso">${icon('x')}</button></div>
  <dialog class="ag-dialog" id="ag-editor" aria-labelledby="ag-title"><div class="ag-dialog-head"><h2 id="ag-title">Nuevo compromiso</h2><button class="ag-round" id="ag-close" aria-label="Cerrar">${icon('x')}</button></div><div id="ag-types" class="ag-types">${Object.entries(kinds).map(([id,k])=>`<button type="button" data-kind="${id}"><span class="ag-event-icon ag-${id.toLowerCase()}">${icon(k.icon)}</span><span>${k.single}</span>${icon('caret-right')}</button>`).join('')}</div>
  <div id="ag-search-area" hidden><form class="ag-search" id="ag-search-form"><input id="ag-query" type="search" placeholder="Nombre, cédula o número de OP" aria-label="Buscar orden" required><button class="ag-button">Buscar</button></form><div class="ag-results" id="ag-results"></div></div>
  <form id="ag-form" hidden><fieldset id="ag-fields"><p id="ag-client" class="ag-context"></p><div class="ag-two"><div><label for="ag-date">Fecha de entrega</label><input type="date" id="ag-date" required></div><div><label for="ag-time">Hora</label><input type="time" id="ag-time" required></div></div><fieldset><legend>Muebles de esta entrega</legend><div id="ag-items"></div></fieldset><label for="ag-notes">Indicaciones</label><textarea id="ag-notes" maxlength="1000"></textarea></fieldset><div class="ag-actions"><button class="ag-button" id="ag-save">Guardar programación</button><button type="button" class="ag-quiet" id="ag-cancel" hidden>Cancelar programación</button></div></form>
  <form id="ag-task-form" hidden><fieldset id="ag-task-fields"><label for="ag-task-title">Asunto</label><input id="ag-task-title" required maxlength="160" placeholder="¿Qué hay que hacer?"><div class="ag-two"><div><label id="ag-contact-label" for="ag-contact">Proveedor o entidad</label><input id="ag-contact" maxlength="160"></div><div><label for="ag-branch">Sede</label><select id="ag-branch" required></select></div></div><div class="ag-two"><div><label for="ag-task-date">Fecha</label><input id="ag-task-date" type="date" required></div><div><label for="ag-task-time">Hora</label><input id="ag-task-time" type="time" required></div></div><div class="ag-two"><div id="ag-amount-wrap"><label for="ag-amount">Valor · opcional</label><input id="ag-amount" type="number" min="1" step="1" inputmode="numeric" placeholder="$"></div><div><label for="ag-assignee">Responsable · opcional</label><input id="ag-assignee" maxlength="120"></div></div><div id="ag-op-wrap"><label for="ag-op">OP relacionada · opcional</label><input id="ag-op" maxlength="120" placeholder="Número de orden"></div><div id="ag-repeat-wrap"><label for="ag-repeat">Repetir</label><select id="ag-repeat"><option value="1">Una sola vez</option><option value="3">Cada mes · 3 fechas</option><option value="6">Cada mes · 6 fechas</option><option value="12">Cada mes · 12 fechas</option></select><small id="ag-repeat-note" hidden>Se crean fechas independientes. Si el día no existe, se usa el último del mes.</small></div><label for="ag-task-notes">Notas · opcional</label><textarea id="ag-task-notes" maxlength="1000"></textarea></fieldset><p class="ag-footnote" id="ag-task-help"></p><button class="ag-button" id="ag-task-save">Guardar compromiso</button></form><p id="ag-error" class="ag-notice" role="status"></p><button id="ag-recover" class="ag-button" hidden>Comprobar y reintentar</button></dialog>
  <dialog class="ag-dialog ag-detail" id="ag-detail" aria-labelledby="ag-detail-title"><div class="ag-dialog-head"><h2 id="ag-detail-title">Compromiso</h2><button class="ag-round" id="ag-detail-close" aria-label="Cerrar detalle">${icon('x')}</button></div><div id="ag-detail-body"></div><p id="ag-detail-notice" class="ag-notice" role="status"></p><button id="ag-detail-recover" class="ag-button" hidden>Comprobar y reintentar</button></dialog>`;
  $('agenda-app').hidden=false;$('ag-refresh').onclick=load;$('ag-new').onclick=()=>openEditor();
  $('ag-close').onclick=()=>{if(!state.busy&&!state.attempt)closeDialog('ag-editor');};
  $('ag-detail-close').onclick=()=>closeDialog('ag-detail');
  for(const id of ['ag-editor','ag-detail']){$(id).addEventListener('cancel',e=>{e.preventDefault();if(!state.busy&&!state.attempt)closeDialog(id);});$(id).addEventListener('click',e=>{if(e.target!==$(id)||state.busy||state.attempt)return;const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(id);});}
  $('ag-today').onclick=()=>{state.allPending=false;state.date=today;state.month=today.slice(0,7);render();};$('ag-expand').onclick=()=>{state.expanded=!state.expanded;calendar();};
  function monthMove(delta){const [y,m]=state.month.split('-').map(Number);state.month=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);state.date=state.month+'-01';render();}
  $('ag-prev').onclick=()=>monthMove(-1);$('ag-next').onclick=()=>monthMove(1);
  let sx=0,sy=0;$('ag-calendar').addEventListener('touchstart',e=>{sx=e.changedTouches[0].screenX;sy=e.changedTouches[0].screenY;},{passive:true});$('ag-calendar').addEventListener('touchend',e=>{const dx=e.changedTouches[0].screenX-sx,dy=e.changedTouches[0].screenY-sy;if(Math.abs(dx)>70&&Math.abs(dy)<40)monthMove(dx<0?1:-1);},{passive:true});
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render();});
  $('ag-find').oninput=()=>{state.query=$('ag-find').value.trim().toLocaleLowerCase('es');render();};$('ag-archive').onclick=()=>{state.archive=!state.archive;render();};
  document.querySelectorAll('[data-kind]').forEach(b=>{b.disabled=b.dataset.kind==='ENTREGA'&&!canOrders();b.onclick=()=>chooseKind(b.dataset.kind);});
  $('ag-search-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter||$('ag-search-form').querySelector('button');button.disabled=true;$('ag-results').textContent='Buscando…';try{const d=await api('ORDENES_LISTAR',{query:$('ag-query').value,limit:30});$('ag-results').innerHTML=d.items.length?d.items.map(o=>`<button type="button" data-op="${esc(o.number)}">${esc(o.client)}<small>${esc(o.number)}</small></button>`).join(''):'No hay órdenes coincidentes.';$('ag-results').querySelectorAll('button').forEach(b=>b.onclick=()=>selectOrder(b.dataset.op));}catch(error){$('ag-results').textContent=error.message;}finally{button.disabled=false;}};
  $('ag-form').onsubmit=e=>{e.preventDefault();saveDelivery(false);};$('ag-cancel').onclick=()=>saveDelivery(true);
  $('ag-task-form').onsubmit=e=>{e.preventDefault();saveTask();};$('ag-repeat').onchange=()=>{$('ag-repeat-note').hidden=$('ag-repeat').value==='1';};
  $('ag-list-recover').onclick=()=>commit();$('ag-recover').onclick=()=>commit();$('ag-detail-recover').onclick=()=>commit();$('ag-undo').onclick=()=>{if(state.undo)changeStatus(state.undo,state.undo.status==='COMPLETADA'?'reopen':'restore',true);};$('ag-toast-close').onclick=()=>{$('ag-toast').hidden=true;state.undo=null;};
  window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});
}
async function openEditor(event=null,number=''){
  if(state.attempt){$('ag-editor').showModal();return;}
  state.edit=event;state.order=null;$('ag-title').textContent=event?'Editar compromiso':'Nuevo compromiso';
  for(const id of ['ag-form','ag-task-form','ag-search-area','ag-recover'])$(id).hidden=true;
  $('ag-types').hidden=!!(event||number);$('ag-error').textContent='';$('ag-query').value='';$('ag-results').textContent='';$('ag-save').textContent='Guardar programación';
  if(!$('ag-editor').open)$('ag-editor').showModal();
  if(event||number){state.kind=event?type(event):'ENTREGA';if(state.kind==='ENTREGA')await selectOrder(event?.number||number);else chooseKind(state.kind,event);}
}
function chooseKind(kind,event=null){
  state.kind=kind;$('ag-types').hidden=true;$('ag-title').textContent=(event?'Editar · ':'')+kinds[kind].single;
  if(kind==='ENTREGA'){$('ag-search-area').hidden=false;$('ag-query').focus();return;}
  $('ag-task-form').hidden=false;$('ag-task-fields').disabled=false;$('ag-task-save').disabled=false;
  const branches=state.session.permissions.includes('*')?['MP','TP']:state.session.profile.branches||[];
  $('ag-branch').innerHTML=branches.map(b=>`<option value="${esc(b)}">${b==='MP'?'Principal':'Terraplaza'}</option>`).join('');$('ag-branch').value=event?.branch||state.session.profile.mainBranch||branches[0];$('ag-branch').disabled=!!event;
  $('ag-task-title').value=event?.title||'';$('ag-contact').value=event?.contact||'';$('ag-assignee').value=event?.assignee||'';$('ag-amount').value=event?.amount||'';
  $('ag-task-date').value=event?.date||state.date;$('ag-task-date').min=event?.date<today?event.date:today;$('ag-task-time').value=event?.time||'';$('ag-task-notes').value=event?.notes||'';$('ag-op').value=event?.number||'';
  $('ag-contact-label').textContent=kind==='GARANTIA'?'Cliente':'Proveedor o entidad';$('ag-op-wrap').hidden=kind!=='GARANTIA'||!canOrders();$('ag-amount-wrap').hidden=kind==='GARANTIA';
  $('ag-repeat').value='1';$('ag-repeat-wrap').hidden=!!event||kind==='GARANTIA';$('ag-repeat-note').hidden=true;
  $('ag-task-help').textContent=kind==='GARANTIA'?'Programa la atención de la garantía.':event?.series?'Editas únicamente esta fecha de la serie.':'Este compromiso no registra un pago en caja.';
  $('ag-task-title').focus();
}
async function selectOrder(number){
  state.kind='ENTREGA';$('ag-types').hidden=true;$('ag-title').textContent=state.edit?'Reprogramar entrega':'Programar entrega';$('ag-form').hidden=false;$('ag-error').textContent='Consultando muebles…';$('ag-save').disabled=true;$('ag-fields').disabled=true;
  try{const d=await api('ORDEN_OBTENER',{number});if(!d)throw Error('No se encontró la OP.');state.order=d;$('ag-search-area').hidden=true;$('ag-client').textContent=d.order.client+' · '+number;
    $('ag-date').value=state.edit?.date||state.date;$('ag-date').min=today;$('ag-time').value=state.edit?.time||'';$('ag-notes').value=state.edit?.notes||'';
    const items=d.items.filter(i=>i.pending>0&&i.status!=='ANULADO');$('ag-items').innerHTML=items.map(i=>{const selected=state.edit?.items.find(x=>x.id===i.id),occupied=state.events.some(e=>e.id!==state.edit?.id&&e.number===number&&pending(e)&&e.items.some(x=>x.id===i.id&&x.remaining>0));return `<label class="ag-item"><input type="checkbox" data-id="${esc(i.id)}" ${selected?'checked':''} ${occupied?'disabled':''}><span>${esc(i.description)}<small>${occupied?'Ya tiene entrega programada':i.pending+' pendientes'}</small></span><input type="number" min="1" max="${i.pending}" step="1" value="${selected?.remaining||i.pending}" aria-label="Cantidad de ${esc(i.description)}" ${occupied?'disabled':''}></label>`;}).join('')||'<p>No quedan muebles pendientes de despacho.</p>';
    $('ag-save').disabled=!state.enabled||!items.length;$('ag-fields').disabled=false;$('ag-cancel').hidden=!state.edit;$('ag-error').textContent='';
  }catch(e){$('ag-error').textContent=e.message;}
}
function saveDelivery(cancel){
  if(state.attempt)return commit();if(!state.order||state.busy)return;
  const items=[...$('ag-items').querySelectorAll('.ag-item')].filter(r=>r.querySelector('[type=checkbox]').checked).map(r=>{const id=r.querySelector('[type=checkbox]').dataset.id;return {id,quantity:Number(r.querySelector('[type=number]').value),revision:state.order.items.find(i=>i.id===id).revision};});
  if(!items.length){$('ag-error').textContent='Selecciona al menos un mueble.';return;}
  return commit({id:state.edit?.id||'',revision:state.edit?.revision||0,number:state.order.order.number,date:$('ag-date').value,time:$('ag-time').value,items,notes:$('ag-notes').value,cancel});
}
function saveTask(){
  if(state.busy)return;const value=id=>$(id).value;
  return commit({kind:state.kind,id:state.edit?.id||'',revision:state.edit?.revision||0,operation:'save',title:value('ag-task-title'),contact:value('ag-contact'),assignee:value('ag-assignee'),branch:value('ag-branch'),number:state.kind==='GARANTIA'?value('ag-op'):'',date:value('ag-task-date'),time:value('ag-task-time'),amount:state.kind==='GARANTIA'||!value('ag-amount')?null:Number(value('ag-amount')),repeat:Number(value('ag-repeat')),notes:value('ag-task-notes')});
}
function openDetail(e){
  if(!e||state.busy||state.attempt)return;const k=kinds[type(e)];$('ag-detail-title').textContent=k.single;$('ag-detail-notice').textContent='';
  const money=e.amount?new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(e.amount):'';
  $('ag-detail-body').innerHTML=`<p class="ag-detail-when">${esc(dayName(e.date))} · ${esc(hourName(e.time))}</p><h3>${esc(type(e)==='ENTREGA'?e.client:e.title)}</h3>${e.contact?`<p>${esc(e.contact)}</p>`:''}${money?`<p class="ag-detail-value">${esc(money)}</p>`:''}${e.assignee?`<p>Responsable: ${esc(e.assignee)}</p>`:''}${e.number?`<a href="${esc(orderLink(e.number))}" class="ag-context">${esc(e.number)} ${icon('arrow-right')}</a>`:''}${e.items.length?`<ul class="ag-detail-items">${e.items.map(i=>`<li>${esc(i.description)}<span>${i.quantity} un.</span></li>`).join('')}</ul>`:''}${e.notes?`<p class="ag-detail-note">${esc(e.notes)}</p>`:''}${e.series?'<p class="ag-footnote">Esta fecha pertenece a una serie mensual. Los cambios afectan solo este compromiso.</p>':''}<div class="ag-actions">${pending(e)&&state.enabled?'<button class="ag-button" id="ag-edit-event">Editar</button><button class="ag-quiet ag-danger" id="ag-cancel-event">Cancelar compromiso</button>':''}${pending(e)&&type(e)!=='ENTREGA'&&state.enabled?'<button class="ag-button ag-secondary" id="ag-complete-event">Marcar realizado</button>':''}${pending(e)&&type(e)==='ENTREGA'?`<a class="ag-button ag-secondary" href="/remision.html?op=${encodeURIComponent(e.number)}&from=agenda&agenda=${encodeURIComponent(e.id)}">Preparar remisión</a>`:''}${e.status==='CANCELADA'&&state.enabled?'<button class="ag-button" id="ag-restore-event">Restaurar compromiso</button>':''}${e.status==='COMPLETADA'&&state.enabled?'<button class="ag-button" id="ag-reopen-event">Volver a pendiente</button>':''}</div>`;
  if($('ag-edit-event'))$('ag-edit-event').onclick=async()=>{await closeDialog('ag-detail');openEditor(e);};
  for(const [id,op] of [['ag-cancel-event','cancel'],['ag-complete-event','complete'],['ag-restore-event','restore'],['ag-reopen-event','reopen']])if($(id))$(id).onclick=()=>changeStatus(e,op);
  if(!$('ag-detail').open)$('ag-detail').showModal();
}
async function changeStatus(e,operation,direct=false){
  if(!e||!state.enabled||state.busy||state.attempt)return;inlineId=direct?e.id:'';if(!direct&&!$('ag-detail').open)openDetail(e);state.busy=true;frozen(true);const notice=direct?$('ag-notice'):$('ag-detail-notice');notice.textContent='Preparando cambio…';
  try{
    let payload={kind:type(e),id:e.id,revision:e.revision,operation};
    if(type(e)==='ENTREGA'){
      const d=await api('ORDEN_OBTENER',{number:e.number});payload={id:e.id,number:e.number,revision:e.revision,date:e.date,time:e.time,notes:e.notes,cancel:operation==='cancel',items:e.items.map(i=>({id:i.id,quantity:operation==='restore'?i.quantity:i.remaining||i.quantity,revision:d.items.find(a=>a.id===i.id)?.revision||1}))};if(operation==='restore')payload.restore=true;
    }
    state.busy=false;await commit(payload);
  }catch(error){notice.textContent=error.message;state.busy=false;frozen(false);inlineId='';}
}
function frozen(on){
  document.querySelectorAll('.ag-swipe').forEach(row=>{row.classList.toggle('ag-saving',on&&row.dataset.id===inlineId);row.setAttribute('aria-busy',String(on&&row.dataset.id===inlineId));row.querySelectorAll('button').forEach(b=>b.disabled=on||!state.enabled);});
  for(const id of ['ag-new','ag-refresh','ag-prev','ag-next','ag-today','ag-expand','ag-archive','ag-find'])$(id).disabled=on||(id==='ag-new'&&!state.enabled);
  document.querySelectorAll('[data-date],[data-filter]').forEach(b=>b.disabled=on);
  $('ag-fields').disabled=on;$('ag-task-fields').disabled=on;for(const id of ['ag-save','ag-task-save','ag-cancel','ag-close','ag-detail-close'])$(id).disabled=on;
  $('ag-detail-body').querySelectorAll('button').forEach(b=>b.disabled=on);
}
async function animateAgendaItem(id,enter=false){
  if(!id||reduced())return;
  const rows=[...document.querySelectorAll('.ag-swipe')].filter(r=>r.dataset.id===id);
  await Promise.all(rows.map(async row=>{if(!row.animate)return;const frames=enter?[{opacity:0,transform:'translateX(16px)'},{opacity:1,transform:'translateX(0)'}]:[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-24px)'}];const motion=row.animate(frames,{duration:enter?220:180,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});try{await motion.finished;}catch{}if(enter)motion.cancel();}));
}
async function commit(payload){
  if(state.busy)return;
  const inList=!!inlineId,inDetail=$('ag-detail').open,notice=inList?$('ag-notice'):inDetail?$('ag-detail-notice'):$('ag-error'),retry=inList?$('ag-list-recover'):inDetail?$('ag-detail-recover'):$('ag-recover');
  if(!state.attempt){if(!payload)return;const attempt={requestId:createRequestId('AGENDA'),payload};try{sessionStorage.setItem(state.key,JSON.stringify(attempt));}catch{notice.textContent='No se pudo conservar el intento en el dispositivo. Libera espacio antes de guardar.';frozen(false);inlineId='';return;}state.attempt=attempt;}
  const attempt=state.attempt;state.busy=true;frozen(true);retry.hidden=true;notice.textContent='Guardando cambio…';
  try{
    const status=await api('AGENDA_GUARDADO_ESTADO',{requestId:attempt.requestId});const response=status.saved?{result:status.result}:await api('AGENDA_GUARDAR',attempt.payload,{requestId:attempt.requestId});
    sessionStorage.removeItem(state.key);state.attempt=null;if(!inList)await closeDialog(inDetail?'ag-detail':'ag-editor');
    if(attempt.payload.operation==='complete')document.querySelectorAll('[data-complete]').forEach(b=>{if(b.dataset.complete===attempt.payload.id)b.setAttribute('aria-checked','true');});
    if(attempt.payload.cancel||['cancel','complete'].includes(attempt.payload.operation))await animateAgendaItem(attempt.payload.id);
    state.date=response.result?.date||attempt.payload.date||state.date;state.month=state.date.slice(0,7);await load();
    if(attempt.payload.restore||['restore','reopen'].includes(attempt.payload.operation))await animateAgendaItem(attempt.payload.id,true);
    const cancelled=attempt.payload.cancel||attempt.payload.operation==='cancel',completed=attempt.payload.operation==='complete';state.undo=cancelled||completed?state.events.find(e=>e.id===attempt.payload.id):null;
    $('ag-toast-text').textContent=cancelled?'Compromiso eliminado':completed?'Compromiso realizado':response.result?.count>1?`${response.result.count} fechas guardadas`:'Cambio guardado';$('ag-undo').hidden=!state.undo;$('ag-toast').hidden=false;
  }catch(e){
    if(e.status>=400&&e.status<500&&e.status!==408&&e.code!=='ORDER_RECOVERY_REQUIRED'){sessionStorage.removeItem(state.key);state.attempt=null;frozen(false);}
    notice.textContent=e.message;retry.hidden=!state.attempt;$('ag-save').textContent=state.attempt?'Comprobar y reintentar':'Guardar programación';
  }finally{state.busy=false;if(!state.attempt){frozen(false);inlineId='';}else{$('ag-save').disabled=false;retry.disabled=false;}}
}
await guardStandalonePage({permission:'agenda.read',render:async({session})=>{
  state.session=session;state.key='maddy.agenda.attempt.'+session.profile.uid;shell();render();await load();
  try{state.attempt=JSON.parse(sessionStorage.getItem(state.key)||'null');}catch{$('ag-notice').textContent='No se pudo recuperar el intento anterior. Revisa la agenda antes de repetirlo.';}
  if(state.attempt){$('ag-editor').showModal();$('ag-types').hidden=true;$('ag-form').hidden=false;frozen(true);$('ag-error').textContent='Hay un guardado por confirmar. Comprueba el intento antes de repetirlo.';$('ag-recover').hidden=false;return;}
  const context=new URLSearchParams(location.search);
  if(context.get('pending')==='1'){state.allPending=true;render();}
  const eventId=context.get('event');if(eventId){const selected=state.events.find(e=>e.id===eventId);if(selected){state.date=selected.date;state.month=selected.date.slice(0,7);render();openDetail(selected);}else{$('ag-notice').textContent='Este compromiso ya no está disponible. Puedes buscarlo en la agenda.';}}
  const number=new URLSearchParams(location.search).get('op');if(number){$('ag-back').href=orderLink(number);$('ag-back').setAttribute('aria-label','Volver a la OP');if(state.enabled&&canOrders())await openEditor(null,number);}
}});

