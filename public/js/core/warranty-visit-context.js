import {escapeHtml as esc} from './format.js';

export function warrantyVisitLink(number,itemId){
  return '/agenda.html?op='+encodeURIComponent(number)+'&tipo=garantia&item='+encodeURIComponent(itemId);
}

export async function loadWarrantyVisit({number,itemId,request,root=document}){
  const data=await request('ORDEN_OBTENER',{number});
  if(!data?.order||data.order.number!==number)throw Error('No se pudo recuperar la OP para la revisión.');
  const item=data.items?.find(i=>i.id===itemId);
  if(!item)throw Error('El mueble no pertenece a esta OP. Abre la revisión desde el mueble correcto.');
  const form=root.getElementById('ag-task-form'),order=data.order;
  const context=root.createElement('section');context.id='ag-warranty-context';context.className='ag-warranty-context';
  context.innerHTML=`<span class="ag-eyebrow">Revisión de garantía</span><h3>${esc(item.description)}</h3><strong>${esc(order.client)}</strong><p>${esc([order.phone,order.alternatePhone].filter(Boolean).join(' · '))}</p><p>${esc([order.address,order.city].filter(Boolean).join(' · '))}</p><a class="ag-context" href="/orden.html?op=${encodeURIComponent(number)}&item=${encodeURIComponent(itemId)}">${esc(number)} · Volver al mueble →</a>`;
  root.getElementById('ag-warranty-context')?.remove();form.prepend(context);
  const set=(id,value)=>{const node=root.getElementById(id);node.value=value||'';};
  set('ag-task-title',('Revisar '+item.description).slice(0,160));set('ag-contact',order.client);set('ag-op',number);set('ag-branch',order.branch);
  if(root.getElementById('ag-branch').value!==order.branch)throw Error('La sede de esta OP no está disponible para tu usuario.');
  root.getElementById('ag-branch').disabled=true;
  root.getElementById('ag-contact').closest('.ag-two').hidden=true;
  root.getElementById('ag-op-wrap').hidden=true;
  root.getElementById('ag-task-notes').placeholder='Describe el problema y la pieza afectada. Ej.: una silla del comedor, pata delantera floja.';
  root.getElementById('ag-task-help').textContent='Programa la revisión. Si es una parte del conjunto, indícala en el título o las notas. La visita no confirma una reparación ni una recogida.';
  return {order,item};
}
