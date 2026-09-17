const qs=(root,selector)=>root?.querySelector(selector)||null;

const monthName=(value)=>{
  if(!/^\d{4}-\d{2}$/.test(String(value||'')))return '';
  const [year,month]=String(value).split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
};

function currentTab(root){
  return [...root.querySelectorAll('.np-tabs [data-tab]')].find(button=>button.getAttribute('aria-pressed')==='true')?.dataset.tab||'quincena';
}

function runPeriod(root){
  const picker=qs(root,'.np-run-picker');
  if(!picker)return null;
  const month=picker.querySelector('input[type="month"]')?.value||'';
  const half=picker.querySelector('select')?.value||'';
  if(!month)return null;
  return {month,half,label:`${half==='2'?'Segunda':half==='1'?'Primera':'Tu'} quincena`,monthLabel:monthName(month)};
}

function ensureHero(root){
  const wrap=qs(root,'.np-wrap');
  const tabs=qs(root,'.np-tabs');
  if(!wrap||!tabs||wrap.classList.contains('np-settings-wrap'))return null;
  let hero=qs(root,'.np-premium-hero');
  if(!hero){
    hero=document.createElement('section');
    hero.className='np-premium-hero';
    hero.innerHTML=`<div class="np-premium-hero-copy"><span class="np-premium-kicker">Nómina Maddy</span><h1 id="np-premium-title">Tu quincena</h1><p id="np-premium-subtitle">Maddy pone primero lo que requiere tu atención.</p></div><div class="np-premium-hero-mark" aria-hidden="true">M</div>`;
    tabs.before(hero);
  }
  return hero;
}

function updateHero(root){
  const hero=ensureHero(root);
  if(!hero)return;
  const title=qs(hero,'#np-premium-title');
  const subtitle=qs(hero,'#np-premium-subtitle');
  const tab=currentTab(root);
  if(tab==='quincena'){
    const period=runPeriod(root);
    title.textContent=period?period.label:'Tu quincena';
    subtitle.textContent=period?.monthLabel?`${period.monthLabel[0].toUpperCase()+period.monthLabel.slice(1)} · Maddy te muestra primero los pagos pendientes.`:'Maddy te muestra primero lo que requiere tu atención.';
  }else if(tab==='comprobantes'){
    title.textContent='Historial de pagos';
    subtitle.textContent='Comprobantes y pagos anteriores, sin mezclarlo con la tarea de hoy.';
  }else if(tab==='comisiones'){
    title.textContent='Comisiones';
    subtitle.textContent='Ventas pendientes y comisiones ya registradas, ordenadas para revisar.';
  }
}

function ensureMenu(root){
  const header=qs(root,'.cfg-header-inner');
  if(!header||qs(root,'.np-premium-menu-trigger'))return;
  const refresh=qs(root,'#np-refresh');
  const config=qs(root,'.np-top .np-actions a[href*="configuracion"]');
  const other=qs(root,'#np-new');
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='np-premium-menu-trigger';
  trigger.setAttribute('aria-label','Más opciones de Nómina');
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.textContent='•••';
  header.append(trigger);

  const dialog=document.createElement('dialog');
  dialog.className='np-premium-menu';
  dialog.id='np-premium-menu';
  const items=[];
  if(refresh)items.push('<button type="button" class="np-premium-menu-item" data-premium-action="refresh"><span>Actualizar nómina</span><span aria-hidden="true">↻</span></button>');
  if(config)items.push(`<a class="np-premium-menu-item" href="${config.getAttribute('href')}"><span>Configuración de nómina</span><span aria-hidden="true">›</span></a>`);
  if(other)items.push('<button type="button" class="np-premium-menu-item" data-premium-action="other"><span>Otro tipo de pago</span><span aria-hidden="true">›</span></button>');
  dialog.innerHTML=`<div class="np-premium-menu-card"><div class="np-premium-menu-handle" aria-hidden="true"></div><div class="np-premium-menu-title"><strong>Más opciones</strong><span>Herramientas que no necesitas para pagar una quincena normal.</span></div><div class="np-premium-menu-list">${items.join('')}</div><button type="button" class="np-premium-menu-close">Cerrar</button></div>`;
  root.append(dialog);
  trigger.addEventListener('click',()=>{if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');});
  qs(dialog,'.np-premium-menu-close')?.addEventListener('click',()=>dialog.close?.());
  qs(dialog,'[data-premium-action="refresh"]')?.addEventListener('click',()=>{dialog.close?.();refresh?.click();});
  qs(dialog,'[data-premium-action="other"]')?.addEventListener('click',()=>{dialog.close?.();other?.click();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close?.();});
}

function enhanceHeader(root){
  const brand=qs(root,'.cfg-brand');
  if(brand){
    const strong=qs(brand,'strong');
    const span=qs(brand,'span');
    if(strong)strong.textContent='Nómina';
    if(span)span.textContent='Maddy';
  }
  ensureMenu(root);
}

function bindPeriodControls(root){
  const picker=qs(root,'.np-run-picker');
  if(!picker)return;
  picker.classList.add('np-premium-period-picker');
  picker.querySelectorAll('input,select').forEach(control=>{
    if(control.dataset.premiumHeroBound)return;
    control.dataset.premiumHeroBound='1';
    control.addEventListener('change',()=>queueMicrotask(()=>updateHero(root)));
  });
}

function enhanceList(root){
  const people=qs(root,'.np-run-people');
  if(!people)return;
  let head=people.previousElementSibling?.classList?.contains('np-premium-list-head')?people.previousElementSibling:null;
  if(!head){
    head=document.createElement('div');
    head.className='np-premium-list-head';
    head.innerHTML='<div><span>Equipo</span><h2>Pagos de esta quincena</h2></div><span class="np-premium-list-count"></span>';
    people.before(head);
  }
  const count=people.querySelectorAll(':scope > .np-run-person').length;
  const pending=[...people.querySelectorAll(':scope > .np-run-person')].filter(card=>!card.classList.contains('np-friendly-paid')).length;
  const badge=qs(head,'.np-premium-list-count');
  if(badge)badge.textContent=pending?`${pending} pendiente${pending===1?'':'s'}`:`${count} completos`;
}

function ready(root){
  const loading=[...root.querySelectorAll('[role="status"]')].some(node=>/Cargando nómina/i.test(node.textContent));
  if(loading)return;
  if(!qs(root,'.np-wrap'))return;
  root.classList.add('np-premium-ready');
  document.getElementById('payroll-boot')?.classList.add('is-hidden');
}

export function enhancePayrollPremiumUx(root){
  if(!root)return;
  root.classList.add('np-premium-root');
  enhanceHeader(root);
  ensureHero(root);
  bindPeriodControls(root);
  enhanceList(root);
  updateHero(root);
  ready(root);
}

export function installPayrollPremiumUx(root){
  if(!root)return()=>{};
  let queued=false;
  const run=()=>{
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;enhancePayrollPremiumUx(root);});
  };
  const observer=new MutationObserver(run);
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed','class']});
  run();
  return()=>observer.disconnect();
}
