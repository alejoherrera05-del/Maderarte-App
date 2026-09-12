import { apiRequest, createRequestId } from './api.js?v=agenda-1';
import { escapeHtml as esc } from './format.js';
import { hasPermission } from './permissions.js';
import { APP_CONFIG } from './config.js';

export const bogotaDay = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
export function pendingToday(items, day) {
  return items.filter(e => e.status === 'PROGRAMADA' && e.date <= day)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.id.localeCompare(b.id));
}
export const agendaLink = e => `/agenda.html?event=${encodeURIComponent(e.id)}&from=inicio`;
const icon = name => `<img src="/assets/icons/${name}.svg" alt="" aria-hidden="true">`;
const labels = { PROVEEDOR: 'Proveedor', IMPUESTO: 'Impuesto', SERVICIO: 'Servicio', GARANTIA: 'Garantía' };

export function mountToday(root, session) {
  const canRead = hasPermission(session, 'agenda.read');
  const key = 'maddy.agenda.attempt.' + session.profile.uid;
  let items = [], enabled = false, busy = false, loaded = false, error = '', undo = null, attempt = null;
  const api = async (action, payload, options) => APP_CONFIG.preview.enabled && action==='AGENDA_LISTAR' ? {items:[],enabled:false} : (await apiRequest(action, payload, options)).data;
  const render = () => {
    const day = bogotaDay(), date = new Date(day + 'T12:00:00Z');
    const pending = pendingToday(items, day);
    const notifications=document.getElementById('dashboard-notifications-popover');
    if(notifications&&canRead)notifications.innerHTML=`<strong>Agenda</strong><p>${loaded?pending.length?`${pending.length} ${pending.length===1?'compromiso pendiente':'compromisos pendientes'} hasta hoy.`:'Sin compromisos pendientes para hoy.':error?'No se pudo consultar la agenda.':'Consultando agenda…'}</p><a href="/agenda.html?pending=1&from=inicio">Abrir agenda</a>`;
    root.innerHTML = `<header class="home-today-heading"><h2>Hoy en Maderarte</h2>${canRead?'<a href="/agenda.html">Ver agenda '+icon('arrow-right')+'</a>':''}</header>
      <div class="home-today-body"><time class="home-date" datetime="${day}"><span>${esc(new Intl.DateTimeFormat('es-CO',{weekday:'short',timeZone:'UTC'}).format(date))}</span><strong>${date.getUTCDate()}</strong><span>${esc(new Intl.DateTimeFormat('es-CO',{month:'long',timeZone:'UTC'}).format(date))}</span></time>
      <div class="home-pending" aria-busy="${busy}">${!canRead?'<div class="home-empty"><strong>Tu espacio de trabajo</strong><p>Los accesos disponibles están arriba.</p></div>':!loaded?'<div class="home-empty" role="status"><strong>'+ (error?'No pudimos cargar la agenda':'Consultando agenda…') +'</strong></div>':pending.length?pending.slice(0,3).map(e=>{
        const task=e.kind && e.kind!=='ENTREGA', title=task?e.title:'Entrega · '+e.client;
        const when=e.date<day?new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(e.date+'T12:00:00Z')):e.time?new Intl.DateTimeFormat('es-CO',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(new Date('2000-01-01T'+e.time+':00Z')):'Hoy';
        return `<article class="home-pending-row" data-id="${esc(e.id)}">${task?`<button type="button" class="home-check" role="checkbox" aria-checked="false" aria-label="Marcar realizado: ${esc(title)}" data-complete="${esc(e.id)}" ${!enabled||busy||attempt?'disabled':''}>${icon('check')}</button>`:`<span class="home-delivery-icon">${icon('truck')}</span>`}<a class="home-event" href="${esc(agendaLink(e))}"><time class="${e.date<day?'is-overdue':''}">${esc(when)}</time><span><strong>${esc(title)}</strong><small>${esc(task?[labels[e.kind],e.contact].filter(Boolean).join(' · '):e.number)}${e.date<day?' · Pendiente anterior':''}</small></span>${icon('caret-right')}</a></article>`;
      }).join(''):'<div class="home-empty">'+icon('calendar-dots')+'<strong>Todo al día</strong><p>No hay compromisos pendientes para hoy.</p></div>'}
      ${pending.length>3?`<a class="home-more" href="/agenda.html?pending=1&from=inicio">Ver los ${pending.length} pendientes ${icon('arrow-right')}</a>`:''}</div></div>
      <div class="home-feedback" role="status">${esc(error)}${attempt?'<a href="/agenda.html">Comprobar guardado</a>':error?'<button type="button" data-retry>Reintentar</button>':''}</div>
      ${undo?`<div class="home-undo" role="status"><span>Compromiso realizado</span><button type="button" data-undo ${busy?'disabled':''}>Deshacer</button></div>`:''}`;
    root.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>change(items.find(e=>e.id===b.dataset.complete),'complete'));
    root.querySelector('[data-undo]')?.addEventListener('click',()=>change(undo,'reopen'));
    root.querySelector('[data-retry]')?.addEventListener('click',load);
  };
  async function load() {
    if(!canRead||busy)return;
    busy=true;render();
    try { const data=await api('AGENDA_LISTAR');items=data.items;enabled=data.enabled&&hasPermission(session,'agenda.update');loaded=true;error=''; }
    catch(e){error=loaded?'No se pudo actualizar. La agenda puede haber cambiado.':e.message;enabled=false;}
    finally {busy=false;render();}
  }
  async function change(event, operation) {
    if(!event||!enabled||busy||attempt||event.kind==='ENTREGA')return;
    try {
      // Share the agenda recovery fence: never overwrite an unresolved attempt.
      if(sessionStorage.getItem(key)){error='Hay un cambio por confirmar en la agenda.';attempt=true;render();return;}
      attempt={requestId:createRequestId('AGENDA'),payload:{kind:event.kind,id:event.id,revision:event.revision,operation}};
      sessionStorage.setItem(key,JSON.stringify(attempt));
    } catch {attempt=null;error='No se pudo proteger el guardado. Inténtalo desde la agenda.';render();return;}
    busy=true;error='Guardando cambio…';render();
    try {
      const status=await api('AGENDA_GUARDADO_ESTADO',{requestId:attempt.requestId});
      const response=status.saved?{result:status.result}:await api('AGENDA_GUARDAR',attempt.payload,{requestId:attempt.requestId});
      sessionStorage.removeItem(key);attempt=null;
      const updated={...event,status:operation==='complete'?'COMPLETADA':'PROGRAMADA',revision:response.result.revision};
      const row=[...root.querySelectorAll('.home-pending-row')].find(r=>r.dataset.id===event.id);
      if(operation==='complete'&&row){row.querySelector('[role=checkbox]')?.setAttribute('aria-checked','true');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&row.animate){const motion=row.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(12px)'}],{duration:180,easing:'ease-out'});await motion.finished.catch(()=>{});}}
      items=items.map(e=>e.id===event.id?updated:e);undo=operation==='complete'?updated:null;error='';
    } catch(e){
      if(e.status>=400&&e.status<500&&![408,425,429].includes(e.status)&&e.code!=='ORDER_RECOVERY_REQUIRED'){sessionStorage.removeItem(key);attempt=null;enabled=false;}
      error=e.message;
    } finally {busy=false;render();}
  }
  render();void load();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!attempt)void load();});
  return {load};
}
