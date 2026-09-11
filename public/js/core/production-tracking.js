import { apiRequest, createRequestId } from './api.js?v=runtime-1';
import { escapeHtml as esc } from './format.js';
const stages={SOLICITADO:'Solicitud realizada',CONFIRMADO:'Confirmado por proveedor',FABRICACION:'En fabricación',LISTO:'Listo en fábrica',TRANSPORTE:'En transporte',BODEGA:'Recibido en bodega'};
export async function bindProductionTracking(root,data,session) {
  if(!session.permissions?.some(p=>p==='*'||p==='produccion.update'))return;
  if(!data.productionTrackingEnabled)return;
  const account={items:data.items.map(i=>({id:i.id,revision:i.revision,tracking:i.tracking}))};
  const key='maddy-production:'+session.profile?.uid+':'+data.order.number;
  const button=document.createElement('button');button.type='button';button.className='ow-update-state';button.textContent='Actualizar estado';
  root.querySelector('.ow-route')?.insertBefore(button,root.querySelector('.ow-maddy'));
  const dialog=document.createElement('dialog');dialog.className='pt-dialog';dialog.setAttribute('aria-label','Actualizar estado del mueble');root.append(dialog);
  let pending;try{pending=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  function syncAction(){const index=Number(root.querySelector('[data-select-item][aria-pressed=true]')?.dataset.selectItem||0),item=data.items[index];button.hidden=!pending&&(!item||item.fulfillment==='DISPONIBLE'||item.pending<=0||item.cancelled>0||item.status==='ANULADO'||data.order.status==='ANULADA'||item.tracking?.legacy);}
  root.querySelectorAll('[data-select-item],[data-item-prev],[data-item-next]').forEach(el=>el.addEventListener('click',syncAction));syncAction();
  function open() {
    const index=Number(root.querySelector('[data-select-item][aria-pressed=true]')?.dataset.selectItem||0),item=data.items[index],snapshot=account.items.find(i=>i.id===item.id);
    if(!snapshot)return;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    dialog.innerHTML=`<header><div><small>${esc(data.order.number)}</small><h2>Actualizar estado</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header><p>${esc(item.description)}</p><form><label>Movimiento<select name="stage">${Object.entries(stages).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><div class="pt-pair"><label>Unidades de este movimiento<input name="quantity" type="number" min="1" max="${item.quantity}" step="1" value="1" required></label><label>Fecha del movimiento<input name="date" type="date" value="${today}" max="${today}" required></label></div><label>Proveedor<input name="provider" maxlength="120" autocomplete="organization"></label><label>Observaciones<textarea name="notes" maxlength="1000" rows="2"></textarea></label><p class="pt-counts">${snapshot.tracking.received} recibidas en bodega · ${snapshot.tracking.available} disponibles</p><label class="pt-confirm"><input type="checkbox" name="verified" required>Confirmo que este movimiento se realizó.</label><p role="status"></p><button class="ow-primary" type="submit">Guardar movimiento</button><button type="button" data-recover hidden>Consultar resultado del intento</button></form>`;
    const form=dialog.querySelector('form'),message=form.querySelector('[role=status]'),submit=form.querySelector('[type=submit]'),recover=form.querySelector('[data-recover]');
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    function lock(value){for(const el of form.elements)el.disabled=value;recover.disabled=false;recover.hidden=!value;}
    async function confirmed(){sessionStorage.removeItem(key);message.textContent='Movimiento registrado. Actualizando la OP…';window.location.reload();}
    async function send(){lock(true);message.textContent='Guardando el movimiento…';try{const result=await apiRequest('PRODUCCION_REGISTRAR',pending.payload,{requestId:pending.id});if(result.data?.saved)await confirmed();else throw new Error('Falta confirmar el resultado.');}catch(e){message.textContent=e.message;if(e.status>=400&&e.status<500&&!e.transient&&e.code!=='ORDER_RECOVERY_REQUIRED'){sessionStorage.removeItem(key);pending=null;lock(false);} }}
    recover.onclick=async()=>{recover.disabled=true;try{const result=await apiRequest('PRODUCCION_REGISTRO_ESTADO',{requestId:pending.id});if(result.data?.saved)await confirmed();else if(result.data?.retrySameRequest){message.textContent='Sin registro confirmado. Puedes reintentar el mismo movimiento.';recover.textContent='Reintentar el mismo movimiento';recover.onclick=send;}else message.textContent='El intento sigue pendiente de confirmación. Consúltalo de nuevo.';}catch(e){message.textContent=e.message;}finally{recover.disabled=false;}};
    form.onsubmit=async e=>{e.preventDefault();if(pending)return;const values=new FormData(form);const payload={number:data.order.number,itemId:item.id,revision:snapshot.revision,stage:values.get('stage'),quantity:Number(values.get('quantity')),date:values.get('date'),provider:values.get('provider').trim(),notes:values.get('notes').trim(),verified:values.has('verified')};pending={id:createRequestId('PRODUCTION'),payload};try{sessionStorage.setItem(key,JSON.stringify(pending));}catch{pending=null;message.textContent='No se pudo proteger el intento en este navegador. No se guardó el movimiento.';return;}await send();};
    if(pending){lock(true);message.textContent='Hay un movimiento pendiente de confirmar. Consulta su resultado antes de registrar otro.';}
    dialog.showModal();
  }
  button.onclick=open;
  dialog.addEventListener('close',()=>button.focus());
  if(pending||(!button.hidden&&new URLSearchParams(window.location.search).get('track')==='1')){open();const url=new URL(window.location.href);url.searchParams.delete('track');window.history.replaceState(null,'',url);}
}

