import { furnitureIcon } from './furniture-category.js?v=category-images-1';
import { productState, journeySteps } from './product-journey.js?v=tracking-1';
import { escapeHtml as esc, money } from './format.js';
import { sandboxLink } from './order-sandbox-context.js';
import { hasPermission } from './permissions.js';


function statusSymbol(state) {
  const paths = {
    amber: '<path d="M8 3H5v18h14V3h-3M8 2h8v4H8zM8 11h8M8 15h5"/>',
    violet: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    green: '<path d="m5 12 4 4L19 6"/>',
    blue: '<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    muted: '<circle cx="12" cy="12" r="8"/><path d="M12 7v6m0 3v1"/>'
  };
  return `<svg class="ow-state-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[state.tone] || paths.muted}</svg>`;
}
function statusLabel(item, order, compact = false) {
  const state = productState(item, order);
  const short = {'Por solicitar a fábrica':'Por solicitar','Disponible para despacho':'Disponible'};
  return `${statusSymbol(state)}<span>${esc(compact ? (short[state.label] || state.label) : state.label)}</span>`;
}

export function renderWorkbench(items, order, session) {
  if (!items.length) return '<p class="od-empty">La orden no tiene muebles asociados.</p>';
  return `<div class="ow-workbench"><nav class="ow-selector" aria-label="Muebles del pedido"><h2>Muebles del pedido <small>${items.length}</small></h2><label class="ow-search"><img src="/assets/icons/magnifying-glass.svg" alt=""><input type="search" placeholder="Buscar mueble" aria-label="Buscar mueble"></label><p class="ow-search-empty" hidden>No hay muebles con ese nombre.</p>${items.map((item,index)=>`<button type="button" class="ow-choice" aria-label="${esc(item.description+' '+productState(item,order).label)}" data-select-item="${index}" aria-pressed="${index===0}"><span class="ow-thumbnail" data-thumbnail="${index}"><img src="${esc(furnitureIcon(item.category))}" alt="" width="84" height="84" decoding="async"></span><span><strong>${esc(item.description)}</strong><span class="product-status tone-${productState(item,order).tone}">${statusLabel(item,order,true)}<span class="ow-unit"> · ${item.quantity} ${item.quantity===1?'unidad':'unidades'}</span></span></span><img class="ow-chevron" src="/assets/icons/caret-right.svg" alt=""></button>`).join('')}${hasPermission(session,'remisiones.read')?`<a class="ow-dispatch" href="${esc(sandboxLink('/remision.html?op='+encodeURIComponent(order.number)+'&from=op'))}"><img src="/assets/icons/truck.svg" alt=""><span><strong>Preparar remisión</strong><small>Seleccionar muebles y cantidades</small></span><img src="/assets/icons/caret-right.svg" alt=""></a>`:''}${hasPermission(session,'abonos.read')?`<a class="ow-abonar" href="${esc(sandboxLink('/abono.html?op='+encodeURIComponent(order.number)))}"><img src="/assets/icons/wallet.svg" alt="">Registrar abono</a>`:''}</nav><div class="ow-detail-list"><div class="ow-mobile-nav"><button type="button" data-list-back>← Los ${items.length} muebles</button><button type="button" data-item-prev aria-label="Mueble anterior">‹</button><span data-item-counter></span><button type="button" data-item-next aria-label="Mueble siguiente">›</button></div>${items.map((item,index)=>`<article class="ow-detail" data-order-item="${esc(item.id)}" data-detail-index="${index}" ${index?'hidden':''}><div class="ow-title"><span>Mueble ${index+1} de ${items.length}</span><h1>${esc(item.description)}</h1><p>${esc([item.fabricColor,item.woodColor].filter(Boolean).join(' · '))}</p></div><div class="ow-photo" data-photo-index="${index}"><img class="ow-no-photo" src="/assets/icons/folder-open.svg" alt=""><p>Sin fotografía de referencia</p></div><div class="ow-tabs" role="tablist" aria-label="Información del mueble">${['Detalles','Referencias','Notas'].map((label,n)=>`<button type="button" role="tab" id="ow-tab-${index}-${n}" aria-controls="ow-panel-${index}-${n}" aria-selected="${n===0}" tabindex="${n===0?'0':'-1'}" data-tab="${n}">${label}</button>`).join('')}</div><section role="tabpanel" id="ow-panel-${index}-0" aria-labelledby="ow-tab-${index}-0"><dl class="ow-specs"><div><dt>Especificaciones</dt><dd>${esc(item.specifications||item.measures||'Sin especificaciones adicionales')}</dd></div><div><dt>Cantidad</dt><dd>${esc(String(item.quantity))} ${esc(item.unit||'UN')}</dd></div>${item.fabricColor?`<div><dt>Tela</dt><dd>${esc(item.fabricColor)}</dd></div>`:''}${item.woodColor?`<div><dt>Madera</dt><dd>${esc(item.woodColor)}</dd></div>`:''}<div><dt>Valor del mueble</dt><dd>${esc(money(item.subtotal))}</dd></div><div><dt>Estado actual</dt><dd><button type="button" class="product-status tone-${productState(item,order).tone}" data-product-journey="${esc(item.id)}">${statusLabel(item,order)}</button></dd></div></dl></section><section class="od-item-copy ow-references" role="tabpanel" id="ow-panel-${index}-1" aria-labelledby="ow-tab-${index}-1" hidden><p class="ow-reference-empty">No hay referencias adjuntas.</p></section><section role="tabpanel" id="ow-panel-${index}-2" aria-labelledby="ow-tab-${index}-2" hidden><p>${esc(item.notes||item.specifications||'Sin notas para este mueble.')}</p></section></article>`).join('')}</div><aside class="ow-route" aria-label="Recorrido del mueble"><div data-route-content></div><div class="ow-maddy" aria-hidden="true"><img class="ow-character" src="/assets/brand/maddy-clientes-natural.webp" alt=""><img class="ow-signature" src="/assets/brand/maddy-by-maderarte.svg" alt=""></div></aside></div>`;
}

export function bindWorkbench(root, data, session) {
  const items=data.items||[], order=data.order||{};
  let selectedIndex=0;
  const search=root.querySelector('.ow-search input');
  search?.addEventListener('input',()=>{let count=0; const q=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); root.querySelectorAll('[data-select-item]').forEach(el=>{el.hidden=!el.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q);if(!el.hidden)count++;});root.querySelector('.ow-search-empty').hidden=count>0;});
  root.querySelector('[data-list-back]')?.addEventListener('click',()=>root.querySelector('.ow-workbench').classList.remove('ow-item-open'));
  root.querySelector('[data-item-prev]')?.addEventListener('click',()=>select(selectedIndex-1));
  root.querySelector('[data-item-next]')?.addEventListener('click',()=>select(selectedIndex+1));
  function select(index, remember = true) {
    const item=items[index];if(!item)return;selectedIndex=index;
    root.querySelector('[data-item-counter]').textContent='Mueble '+(index+1)+' de '+items.length;
    root.querySelector('[data-item-prev]').disabled=index===0;root.querySelector('[data-item-next]').disabled=index===items.length-1;
    if(remember||new URLSearchParams(window.location.search).has('item'))root.querySelector('.ow-workbench').classList.add('ow-item-open');
    const active=root.querySelector('[data-detail-index="'+index+'"]');active.append(root.querySelector('.ow-route')); 
    root.querySelectorAll('[data-select-item]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.selectItem)===index)));
    root.querySelectorAll('[data-detail-index]').forEach(el=>el.hidden=Number(el.dataset.detailIndex)!==index);
    if (remember) { const url=new URL(window.location.href); url.searchParams.set('item',item.id); window.history.replaceState(null,'',url); }
    const state=productState(item,order), factory=item.fulfillment==='PARA_SOLICITAR'&&!(item.tracking?.available>0);
    const canAct=!['Anulado','Revisar ajuste'].includes(state.label)&&item.pending>0&&hasPermission(session,factory?'produccion.read':'remisiones.read');
    root.querySelector('[data-route-content]').innerHTML=`<h2>${esc(state.label)}</h2><p class="ow-current">${esc(state.note)}</p><details class="ow-journey"><summary>Ver recorrido completo</summary><ol class="product-journey">${journeySteps(item,order).map(s=>`<li class="${s.done?'is-done':s.current?'is-current':'is-future'}"><span class="journey-marker" aria-hidden="true"></span><div><strong>${esc(s.label)}</strong><p>${esc(item.tracking?.events?.length?s.detail:(s.done ? (s.label === 'Registrado en la OP' ? order.number : 'Registrado') : s.current ? 'Estado actual' : 'Sin registro'))}</p></div></li>`).join('')}</ol></details>${canAct?`<a class="ow-primary" href="${esc(sandboxLink('/'+(factory?'produccion':'remision')+'.html?op='+encodeURIComponent(order.number)+'&from=op&item='+encodeURIComponent(item.id)))}">${factory?'Preparar solicitud':'Preparar remisión'}<img src="/assets/icons/arrow-right.svg" alt=""></a>`:''}`;
  }
  root.querySelectorAll('[data-select-item]').forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.selectItem))));
  root.querySelectorAll('.ow-tabs').forEach(tabs=>{
    const buttons=[...tabs.querySelectorAll('[role=tab]')];
    const activate=button=>{buttons.forEach(el=>{const active=el===button;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;root.querySelector('#'+el.getAttribute('aria-controls')).hidden=!active;});};
    buttons.forEach((button,index)=>{button.addEventListener('click',()=>activate(button));button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();activate(buttons[next]);buttons[next].focus();});});
  });
  const initial=items.findIndex(item=>item.id===new URLSearchParams(window.location.search).get('item'));
  select(initial<0?0:initial,false);
}

