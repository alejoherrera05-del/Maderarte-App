import { apiRequest } from './api.js?v=production-overview-1';
import { escapeHtml as esc } from './format.js';
import { sandboxLink } from './order-sandbox-context.js';
import { hasPermission } from './permissions.js';
import { furnitureIcon } from './furniture-category.js?v=category-images-1';
import { productionStages,filterProduction,loadProductionOverview } from './production-overview-model.js';
const labels=Object.fromEntries(productionStages);

export async function mountProductionOverview(root,session,{request=apiRequest}={}) {
  let entries=[],enabled=false,stage=new URLSearchParams(location.search).get('estado')||'ALL',busy=false;
  if(!labels[stage])stage='ALL';
  root.innerHTML=`<div class="po-page"><header class="po-header"><a class="po-round" href="${esc(sandboxLink('/index.html'))}" aria-label="Volver al inicio"><img src="/assets/icons/arrow-left.svg" alt=""></a><div class="po-brand"><img src="/assets/brand/maddy-signature.svg" alt="Maddy"><img src="/assets/brand/maddy-endorsement.svg" alt="by Maderarte"></div><button class="po-round" type="button" data-refresh aria-label="Actualizar producción"><img src="/assets/icons/arrow-clockwise.svg" alt=""></button></header>
  <main class="po-main"><section class="po-hero"><div><p>Del proveedor al almacén</p><h1>Producción</h1><div class="po-hero-actions"><a class="po-primary" href="${esc(sandboxLink('/produccion.html?buscar=1'))}">Preparar solicitud <span aria-hidden="true">↗</span></a><a class="po-quiet" href="${esc(sandboxLink('/agenda.html'))}">Ver agenda <span aria-hidden="true">→</span></a></div></div><img class="po-maddy" src="/assets/brand/maddy-production-hd.webp" width="1086" height="1448" alt="Maddy revisa medidas para fabricación"></section>
  <section class="po-toolbar" aria-label="Buscar y filtrar muebles"><label class="po-search"><img src="/assets/icons/magnifying-glass.svg" alt=""><input type="search" data-search aria-label="Buscar mueble, OP, cliente o proveedor" placeholder="Mueble, OP, cliente o proveedor" autocomplete="off"></label><label class="po-provider"><span>Proveedor</span><select data-provider><option value="">Todos los proveedores</option></select></label><label class="po-mobile-stage"><span>Estado</span><select data-stage>${productionStages.map(([id,label])=>`<option value="${id}" ${id===stage?'selected':''}>${label}</option>`).join('')}</select></label></section>
  <div class="po-workspace"><nav class="po-stages" aria-label="Estado de producción">${productionStages.map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${id===stage}"><span>${label}</span><span data-count="${id}">—</span></button>`).join('')}</nav><section class="po-results" aria-label="Muebles pendientes"><div class="po-list-heading"><h2 data-heading>Todos los muebles</h2><span data-total></span></div><p class="po-status" data-status role="status"></p><div data-list></div></section></div></main></div>`;
  const $=s=>root.querySelector(s),list=$('[data-list]'),status=$('[data-status]');
  const initial=new URLSearchParams(location.search);$('[data-search]').value=initial.get('q')||'';
  function keepContext(){const url=new URL(location.href);for(const [key,value] of [['estado',stage==='ALL'?'':stage],['q',$('[data-search]').value],['proveedor',$('[data-provider]').value]]){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}history.replaceState(null,'',url);}
  function row(entry){
    const {item,order,buckets,providers}=entry,params=new URLSearchParams({op:order.number,item:item.id,from:'produccion'}),orderUrl=sandboxLink('/orden.html?'+params);
    const review=buckets.some(b=>b.stage==='REVIEW'),canRequest=buckets.some(b=>['PENDING','SEPARADO'].includes(b.stage))&&item.fulfillment==='PARA_SOLICITAR'&&!review;
    const canShip=!review&&item.agreement!=='SEPARADO'&&(item.fulfillment==='DISPONIBLE'||item.tracking?.available>0)&&hasPermission(session,'remisiones.read');
    const canTrack=!review&&item.fulfillment==='PARA_SOLICITAR'&&enabled&&hasPermission(session,'produccion.update');
    const actions=[canRequest?`<a href="${esc(sandboxLink('/produccion.html?'+params))}">Preparar solicitud <span aria-hidden="true">→</span></a>`:'',canTrack?`<a href="${esc(sandboxLink('/orden.html?'+params+'&track=1'))}">Actualizar estado <span aria-hidden="true">→</span></a>`:'',canShip?`<a href="${esc(sandboxLink('/remision.html?'+params))}">Preparar remisión <span aria-hidden="true">→</span></a>`:''].join('');
    return `<article class="po-item"><a class="po-item-main" href="${esc(orderUrl)}"><img class="po-furniture" src="${esc(furnitureIcon(item.category))}" width="96" height="96" alt="" loading="lazy"><div class="po-item-copy"><p class="po-order">${esc(order.number)} · ${esc(order.branch)}</p><h3>${esc(item.description)}</h3><p class="po-client">${esc(order.client)}</p><p class="po-finish">${esc([item.fabricColor,item.woodColor].filter(Boolean).join(' · '))}</p></div><span class="po-open" aria-hidden="true">↗</span></a><div class="po-item-body"><div class="po-state-line">${buckets.map(b=>`<span class="po-state" data-tone="${b.stage}"><i aria-hidden="true"></i>${esc(labels[b.stage])}<strong>${b.quantity} ${b.quantity===1?'unidad':'unidades'}</strong></span>`).join('')}</div><p class="po-provider-line">${esc(providers.length?providers.join(' · '):'Sin proveedor registrado')}${entry.lastDate?' · Último movimiento '+esc(entry.lastDate.split('-').reverse().join('/')):''}</p>${item.agreement==='SEPARADO'?'<p class="po-agreement">Separado · coordinar con el cliente antes de solicitar o entregar.</p>':''}${actions?`<div class="po-item-actions">${actions}</div>`:''}</div></article>`;
  }
  function render(){
    keepContext();const query=$('[data-search]').value,provider=$('[data-provider]').value,base=filterProduction(entries,{query,provider}),visible=filterProduction(base,{stage});
    for(const [id] of productionStages){$(`[data-count="${id}"]`).textContent=String(filterProduction(base,{stage:id}).length);$(`[data-filter="${id}"]`).setAttribute('aria-pressed',String(id===stage));}
    $('[data-stage]').value=stage;$('[data-heading]').textContent=stage==='ALL'?'Muebles pendientes':labels[stage];$('[data-total]').textContent=`${visible.length} ${visible.length===1?'mueble':'muebles'}`;
    list.innerHTML=visible.length?visible.map(row).join(''):`<div class="po-empty"><img src="/assets/icons/check.svg" alt=""><h3>${entries.length?'Sin coincidencias':'No hay muebles pendientes'}</h3><p>${entries.length?'Prueba otro estado, proveedor o búsqueda.':'Los muebles de las OP activas aparecerán aquí con su seguimiento.'}</p>${entries.length?'<button type="button" data-clear>Limpiar filtros</button>':''}</div>`;
    $('[data-clear]')?.addEventListener('click',()=>{$('[data-search]').value='';$('[data-provider]').value='';stage='ALL';render();});
  }
  async function load(){
    if(busy)return;busy=true;$('[data-refresh]').disabled=true;list.setAttribute('aria-busy','true');status.textContent='Consultando muebles pendientes…';
    try {const result=await loadProductionOverview(request,n=>{status.textContent=n?`Consultando producción · ${n} muebles cargados…`:'Consultando muebles pendientes…';});entries=result.entries;enabled=result.enabled;
      const selected=$('[data-provider]').value||initial.get('proveedor')||'';const providers=[...new Set(entries.flatMap(e=>e.providers))].sort((a,b)=>a.localeCompare(b,'es'));
      $('[data-provider]').innerHTML='<option value="">Todos los proveedores</option>'+providers.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');if(providers.includes(selected))$('[data-provider]').value=selected;
      render();status.textContent='Actualizado a las '+new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit'}).format(new Date());
    }catch(error){status.textContent=(entries.length?'No se pudo actualizar. Se conserva la última consulta. ':'')+error.message;if(!entries.length)list.innerHTML='<div class="po-empty"><h3>No pudimos cargar Producción</h3><p>Vuelve a intentarlo con el botón de actualizar.</p></div>';
    }finally{busy=false;$('[data-refresh]').disabled=false;list.removeAttribute('aria-busy');}
  }
  root.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{stage=b.dataset.filter;render();}));
  $('[data-stage]').addEventListener('change',e=>{stage=e.target.value;render();});$('[data-search]').addEventListener('input',render);$('[data-provider]').addEventListener('change',render);$('[data-refresh]').addEventListener('click',load);
  await load();return {refresh:load};
}

