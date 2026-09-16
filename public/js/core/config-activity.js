import {escapeHtml as esc, dateTime, humanizeCode, initials} from './format.js';

const labels={EQUIPO:'Equipo',PRODUCCION:'Producción',GARANTIAS:'Garantías',RECAUDOS:'Recaudos',AJUSTES:'Ajustes',CONFIGURACION:'Configuración',ORDENES:'Órdenes',COTIZACIONES:'Cotizaciones',ABONOS:'Abonos',REMISIONES:'Remisiones',AGENDA:'Agenda'};
const actions={PERMISOS_INDIVIDUALES:'Actualizó los permisos',ACTIVAR_CUENTA:'Reactivó una cuenta',DESACTIVAR_CUENTA:'Desactivó una cuenta',PRODUCCION_REGISTRAR:'Actualizó producción',RECIBIR_EFECTIVO:'Confirmó recepción de efectivo',ORDEN_CREAR:'Creó una orden',COTIZACION_CREAR:'Creó una cotización',RECIBO_CREAR:'Registró un abono',REMISION_CREAR:'Registró una entrega'};
const statusName=s=>({CONFIRMADA:'Confirmado',CONFIRMADO:'Confirmado',EXITOSO:'Completado',FALLIDO:'Fallido',ERROR:'Error'}[s]||humanizeCode(s)||'Sin estado');
Object.assign(actions,{ACTIVACION_COMERCIAL_PREPARADA:'Actualizó el modo operativo',MATRIZ_OPERATIVA_APROBADA:'Confirmó los accesos operativos',SAVE:'Guardó un compromiso',CANCEL:'Canceló un compromiso',REOPEN:'Reabrió un compromiso',COMPLETE:'Marcó un compromiso como cumplido',RESTORE:'Restauró un compromiso'});
export const actionName=s=>actions[String(s).toUpperCase()]||humanizeCode(s)||'Actividad registrada';
export function referenceName(d){
  if(d.reference==='MODO_OPERACION')return 'Modo operativo';
  if(d.reference==='operational-roles-v1')return 'Accesos del equipo';
  if(d.module==='AGENDA'&&/^AGENDA-[a-f0-9-]+$/i.test(d.reference))return 'Compromiso de agenda';
  return d.reference||'Sin referencia';
}
const permissionLabels={"auditoria.read":"Consultar cambios de todas las sedes","app.access":"Entrar a Maddy","perfil.read":"Consultar su perfil","clientes.read":"Consultar clientes","clientes.create":"Crear clientes","cotizaciones.read":"Consultar cotizaciones","cotizaciones.create":"Crear cotizaciones","cotizaciones.update.all":"Completar documentos de otros asesores","ordenes.read":"Consultar órdenes","ordenes.create":"Crear órdenes","ordenes.update.own":"Actualizar documentos propios","ordenes.update.all":"Completar documentos de otros asesores","abonos.read":"Consultar abonos","abonos.create":"Registrar abonos","remisiones.read":"Consultar remisiones","remisiones.create":"Registrar remisiones","produccion.read":"Consultar producción","produccion.update":"Actualizar producción","agenda.read":"Consultar agenda y garantías","agenda.update":"Gestionar agenda y garantías","ajustes.desistir":"Retirar muebles de una orden","ajustes.retornar":"Registrar devolución de un mueble","ajustes.transferir":"Trasladar saldo a otra orden","ajustes.devolver":"Registrar devolución de dinero","recaudos.read":"Consultar ingresos por sede","recaudos.receive":"Confirmar efectivo recibido","config.read":"Consultar configuración","users.manage":"Administrar equipo y sus accesos"};
function valueText(v,field){
  if(v===null)return 'Sin registro';
  if(v==='')return 'Vacío';
  if(field==='Modo operativo')return ({PREPARACION:'Preparación',OPERACION:'Operación'}[v]||v);
  if(field==='Permisos')return v.split(', ').map(p=>(permissionLabels[p]||humanizeCode(p.replaceAll('.', ' ')))).join(' · ');
  if(/^[A-Z_]+$/.test(v))return humanizeCode(v);
  return v;
}
export function activityDetailMarkup(d){
  return `<div class="activity-detail-lead"><span class="activity-avatar">${esc(initials(d.actor))}</span><div><strong>${esc(d.actor)}</strong><p>${esc(dateTime(d.date))}</p></div></div>
    <dl class="activity-facts"><div><dt>Módulo</dt><dd>${esc(labels[d.module]||humanizeCode(d.module))}</dd></div><div><dt>Resultado</dt><dd>${esc(statusName(d.status))}</dd></div><div><dt>Referencia</dt><dd>${esc(referenceName(d))}</dd></div><div><dt>Dispositivo</dt><dd>${esc([d.device,d.browser,d.platform].filter(Boolean).join(' · ')||'No registrado en esta operación')}</dd></div></dl>
    ${/^\/(orden|cotizacion-ver)\.html\?/.test(d.href||'')?`<a class="cfg-copy-button" href="${esc(d.href)}">Abrir documento relacionado →</a>`:''}<h3 class="activity-changes-title">Qué cambió</h3>${!d.hasBefore?'<p class="activity-muted">Este registro no conserva campos anteriores comparables.</p>':''}
    ${d.changes.length?`<div class="activity-changes">${d.changes.map(x=>`<section class="activity-change"><h4>${esc(x.field)}</h4><div class="activity-compare"><div><span>Antes</span><p>${esc(valueText(x.before,x.field))}</p></div><div><span>Después</span><p>${esc(valueText(x.after,x.field))}</p></div></div></section>`).join('')}</div>`:'<p class="activity-empty">Este evento no contiene campos comparables disponibles. Se conserva la constancia de la acción.</p>'}`;
}
export function mountActivity({root,request,openDialog,choosePanel}){
  const nav=root.querySelector('.cfg-nav');
  const button=document.createElement('button');button.dataset.section='actividad';button.textContent='Actividad';button.setAttribute('aria-pressed','false');nav.append(button);
  const panel=document.createElement('section');panel.dataset.panel='actividad';panel.hidden=true;
  panel.innerHTML=`<div class="team-heading"><div><h1>Actividad</h1><p>Los cambios registrados en Maddy.</p></div><button class="cfg-copy-button" id="activity-refresh">Actualizar</button></div>
    <form class="activity-filters" id="activity-filters"><label class="activity-search">Buscar<input name="query" type="search" placeholder="Documento, acción o dispositivo" maxlength="120"></label><label>Desde<input name="from" type="date"></label><label>Hasta<input name="to" type="date"></label><label>Módulo<select name="module"><option value="">Todos los módulos</option></select></label><label>Persona<select name="actor"><option value="">Todas las personas</option></select></label><label>Resultado<select name="status"><option value="">Todos</option><option value="CONFIRMADA">Confirmado</option><option value="EXITOSO">Completado</option><option value="FALLIDO">Fallido</option><option value="ERROR">Error</option></select></label><button class="cfg-submit" type="submit">Filtrar</button></form>
    <div class="activity-caption"><h2>Historial de cambios</h2><span id="activity-count" role="status"></span></div><div id="activity-list" class="activity-list"></div>
    <div class="activity-pagination"><button class="cfg-copy-button" id="activity-prev" disabled>Anterior</button><span id="activity-page"></span><button class="cfg-copy-button" id="activity-next" disabled>Siguiente</button></div><p class="activity-footnote">Solo se muestran acciones registradas. Algunos eventos antiguos no conservan todos los detalles.</p>`;
  root.querySelector('.cfg-panels').insertBefore(panel,root.querySelector('.team-footer'));
  const $=id=>panel.querySelector('#'+id),form=$('activity-filters');let offset=0,loaded=false,sequence=0,detailSequence=0;
  const values=()=>Object.fromEntries(new FormData(form));
  function options(name,items,label){const select=form.elements.namedItem(name),selected=select.value;select.innerHTML=`<option value="">${label}</option>`+items.map(x=>`<option value="${esc(x)}">${esc(labels[x]||x)}</option>`).join('');select.value=selected;}
  async function load(){
    const seq=++sequence;loaded=true;$('activity-list').setAttribute('aria-busy','true');$('activity-count').textContent='Consultando…';$('activity-prev').disabled=true;$('activity-next').disabled=true;
    try{
      const d=await request('ACTIVIDAD_LISTAR',{...values(),offset});if(seq!==sequence)return;
      options('module',d.modules,'Todos los módulos');options('actor',d.actors,'Todas las personas');
      $('activity-count').textContent=`${d.total} ${d.total===1?'registro':'registros'}`;
      $('activity-list').innerHTML=d.items.length?d.items.map(x=>`<button class="activity-row" data-activity="${esc(x.id)}"><span class="activity-avatar" aria-hidden="true">${esc(initials(x.actor))}</span><span class="activity-copy"><strong>${esc(actionName(x.action))}</strong><span>${esc(x.actor)} · ${esc(labels[x.module]||humanizeCode(x.module))}</span><small>${esc(referenceName(x))}</small></span><span class="activity-side"><time>${esc(dateTime(x.date))}</time><span class="activity-status ${['ERROR','FALLIDO'].includes(x.status)?'is-error':''}">${esc(statusName(x.status))}</span></span><span class="activity-arrow" aria-hidden="true">›</span></button>`).join(''):'<div class="activity-empty"><strong>No hay cambios en esta consulta</strong><p>Prueba con otras fechas o filtros.</p></div>';
      $('activity-prev').disabled=offset===0;$('activity-next').disabled=!d.hasMore;$('activity-page').textContent=d.total?`${offset+1}–${offset+d.items.length} de ${d.total}`:'';
      panel.querySelectorAll('[data-activity]').forEach(b=>b.onclick=async()=>{
        const detail=++detailSequence;openDialog('Detalle de actividad','<p class="activity-empty" role="status">Consultando el cambio…</p>');
        try{const x=await request('ACTIVIDAD_OBTENER',{id:b.dataset.activity});if(detail!==detailSequence||!root.querySelector('#cfg-detail').open)return;openDialog(actionName(x.action),activityDetailMarkup(x));}
        catch(e){if(detail===detailSequence&&root.querySelector('#cfg-detail').open)openDialog('Detalle de actividad',`<p class="activity-empty" role="alert">${esc(e.message)}</p>`);}
      });
    }catch(e){if(seq!==sequence)return;$('activity-count').textContent='';$('activity-list').innerHTML=`<div class="activity-empty" role="alert"><p>${esc(e.message)}</p><button class="cfg-copy-button" id="activity-retry">Reintentar</button></div>`;$('activity-retry').onclick=load;}
    finally{if(seq===sequence)$('activity-list').removeAttribute('aria-busy');}
  }
  button.onclick=()=>{choosePanel('actividad');if(!loaded)void load();};
  form.onsubmit=e=>{e.preventDefault();offset=0;void load();};$('activity-refresh').onclick=()=>{offset=0;void load();};
  $('activity-prev').onclick=()=>{offset=Math.max(0,offset-25);void load();};$('activity-next').onclick=()=>{offset+=25;void load();};
  return {open:()=>button.click()};
}
