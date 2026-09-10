import { escapeHtml as esc } from './format.js';
import { sandboxLink } from './order-sandbox-context.js';
export function productState(item, order = {}) {
  if (order.status === 'ANULADA' || item.status === 'ANULADO') return {label:'Anulado',tone:'muted',note:'Este producto no tiene acciones de entrega.'};
  if (item.cancelled > 0) return {label:'Revisar ajuste',tone:'amber',note:'Hay unidades desistidas. Revisa las cantidades del expediente.'};
  if (item.delivered > 0 && item.pending === 0) return {label:'Despachado',tone:'blue',note:'Salida del almacén completa. No confirma recepción del cliente.'};
  if (item.delivered > 0) return {label:'Despacho parcial',tone:'blue',note:`${item.delivered} despachadas · ${item.pending} pendientes`};
  if(item.tracking?.received>0) return {label:item.tracking.received<item.quantity?'En bodega · parcial':'En bodega',tone:'green',note:`${item.tracking.available} disponibles · ${item.quantity-item.tracking.received} por recibir`};
  if(item.tracking?.stage) { const names={SOLICITADO:'Solicitado',CONFIRMADO:'Confirmado por proveedor',FABRICACION:'En fabricación',LISTO:'Listo en fábrica',TRANSPORTE:'En transporte'}; return {label:names[item.tracking.stage]||'En seguimiento',tone:'amber',note:'Movimiento registrado en el historial del mueble.'}; }
  if (item.fulfillment === 'PARA_SOLICITAR') return {label:item.agreement === 'SEPARADO'?'Separado · requiere fábrica':'Por solicitar a fábrica',tone:'amber',note:'Solicitud aún no registrada.'};
  if (item.agreement === 'SEPARADO') return {label:'Separado',tone:'violet',note:item.fulfillment==='DISPONIBLE'?'Disponible en almacén · reservado para el cliente.':'Disponibilidad por confirmar.'};
  if (item.fulfillment === 'DISPONIBLE') return {label:'Disponible para despacho',tone:'green',note:'La entrega se registra al confirmar una remisión.'};
  return {label:'Por definir',tone:'muted',note:'Falta definir la disponibilidad del mueble.'};
}
export function journeySteps(item, order) {
  if(item.tracking?.events?.length) return item.tracking.events.map(e=>({label:({SOLICITADO:'Solicitado',CONFIRMADO:'Confirmado',FABRICACION:'En fabricación',LISTO:'Listo en fábrica',TRANSPORTE:'En transporte',BODEGA:'Recibido en bodega'})[e.stage]||e.stage,detail:`${e.quantity} unidades · ${e.date} · ${e.by}${e.notes?' · '+e.notes:''}`,done:true}));
  const state=productState(item,order),factory=item.fulfillment==='PARA_SOLICITAR';
  const steps=[{label:'Registrado en la OP',detail:order.number||'',done:true}];
  if(item.agreement==='SEPARADO') steps.push({label:'Separado',detail:'El pago no autoriza fabricación. Se espera el aviso del cliente.',done:true});
  if(factory) steps.push({label:'Solicitud al proveedor',detail:'Por solicitar en la OP. No hay seguimiento del envío en Maddy.',current:!item.delivered},{label:'Confirmación y fabricación',detail:'Sin confirmación registrada. No se deduce del mensaje de WhatsApp.'},{label:'Transporte a Popayán',detail:'Sin seguimiento registrado.'});
  steps.push({label:'Disponible en almacén',detail:item.fulfillment==='DISPONIBLE'?'Disponibilidad registrada en la OP.':'Recepción en bodega pendiente de registrar.',done:item.fulfillment==='DISPONIBLE',current:!factory&&!item.delivered});
  steps.push({label:item.pending===0&&item.delivered>0?'Despacho completo':'Despacho al cliente',detail:item.delivered>0?`${item.delivered} despachadas · ${item.pending} pendientes`:'Sin salida registrada.',done:item.pending===0&&item.delivered>0,current:item.delivered>0&&item.pending>0});
  if(state.label==='Anulado'||item.cancelled>0)return [{label:state.label,detail:state.note,current:true}];
  return steps;
}
export function bindProductJourney(root,data) {
  const dialog=document.createElement('dialog');dialog.className='product-sheet';dialog.setAttribute('aria-label','Recorrido del producto');root.append(dialog);
  let trigger;
  root.querySelectorAll('[data-product-journey]').forEach(button=>button.addEventListener('click',()=>{
    const item=data.items.find(i=>i.id===button.dataset.productJourney);if(!item)return;trigger=button;
    const state=productState(item,data.order);
    dialog.innerHTML=`<header class="product-sheet-head"><span>Recorrido del producto</span><button type="button" aria-label="Cerrar recorrido"><img src="/assets/icons/x.svg" alt=""></button></header><div class="product-sheet-body"><span class="product-status tone-${state.tone}">${esc(state.label)}</span><h2>${esc(item.description)}</h2><p>${esc(state.note)}</p><ol class="product-journey">${journeySteps(item,data.order).map(s=>`<li class="${s.done?'is-done':s.current?'is-current':'is-future'}"><span class="journey-marker" aria-hidden="true">${s.done?'✓':''}</span><div><strong>${esc(s.label)}</strong><p>${esc(s.detail)}</p></div></li>`).join('')}</ol><p class="journey-footnote">Cada etapa necesita su propio registro. Despachar no confirma la recepción del cliente.</p>${!['Anulado','Revisar ajuste'].includes(state.label)&&item.pending>0?`<a class="workspace-primary" href="${esc(sandboxLink('/'+(item.fulfillment==='PARA_SOLICITAR'?'produccion':'remision')+'.html?op='+encodeURIComponent(data.order.number)+'&from=op&item='+encodeURIComponent(item.id)))}">${item.fulfillment==='PARA_SOLICITAR'?'Preparar solicitud':'Preparar remisión'}<img src="/assets/icons/arrow-right.svg" alt=""></a>`:''}</div>`;
    dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.showModal();
  }));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>trigger?.focus());
}
