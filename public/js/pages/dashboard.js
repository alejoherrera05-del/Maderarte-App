import { APP_CONFIG, withPreview } from '../core/config.js';
import { escapeHtml } from '../core/format.js';
import { guardPage } from '../core/page-guard.js';
import { mountToday } from '../core/dashboard-today.js?v=home-4';
import { filterByPermission } from '../core/permissions.js';

const MENU_GROUPS = Object.freeze([
  {
    key: 'diario', label: 'Día a día', tone: 'orange', primary: true, items: [
      { key: 'ventas', label: 'Ventas', description: 'Crear una OP o consultar tus ventas', icon: 'clipboard-text', permission: 'ordenes.read', options: [
        { permission: 'ordenes.create', label: 'Nueva orden', description: 'Registrar una venta y sus muebles', href: '/pedido.html' },
        { label: 'Ver órdenes', description: 'Consultar OP, pagos y saldos', href: '/ordenes.html' }
      ] },
      { key: 'cotizaciones', label: 'Cotizaciones', description: 'Crear propuestas y hacer seguimiento', icon: 'file-text', permission: 'cotizaciones.read', options: [
        { permission: 'cotizaciones.create', label: 'Nueva cotización', description: 'Crear una propuesta con items y referencias', href: '/cotizacion.html' },
        { label: 'Ver cotizaciones', description: 'Radar comercial por antigüedad y valor', href: '/cotizaciones.html' }
      ] },
      { key: 'abonos', label: 'Abonos', description: 'Registrar pagos y emitir recibos de caja', icon: 'wallet', permission: 'abonos.read', href: '/abono.html' },
      { key: 'remisiones', label: 'Remisiones', description: 'Buscar una OP y preparar la entrega', icon: 'truck', permission: 'remisiones.read', href: '/remision.html' }
    ]
  },
  {
    key: 'operacion', label: 'Más herramientas', tone: 'gold', items: [
      { key: 'clientes', label: 'Clientes', description: 'Datos, cotizaciones y órdenes', icon: 'users-three', permission: 'clientes.read', href: '/clientes.html' },
      { key: 'produccion', label: 'Producción', description: 'Preparar solicitudes a fábrica', icon: 'stack', permission: 'produccion.read', href: '/produccion.html' },
      
      { key: 'agenda', label: 'Agenda', description: 'Entregas y compromisos', icon: 'calendar-dots', permission: 'agenda.read', href: '/agenda.html' }
    ]
  }
]);

function dayPart(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return { key: 'morning', greeting: 'Buenos días' };
  if (hour < 18) return { key: 'afternoon', greeting: 'Buenas tardes' };
  return { key: 'night', greeting: 'Buenas noches' };
}

function formattedDate(date = new Date()) {
  const value = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function firstName(profile) {
  const value = String(profile?.name || '').trim().split(/\s+/)[0];
  return value || 'equipo Maderarte';
}

function menuItem(item, tone) {
  const permission = item.permission ? ` data-permission="${escapeHtml(item.permission)}"` : '';
  const core = `<span class="dashboard-menu-icon"><img src="/assets/icons/${escapeHtml(item.icon)}.svg" alt="" aria-hidden="true"></span>
    <span class="dashboard-menu-copy"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.description)}</span></span>`;

  if (item.available === false) {
    return `<div class="dashboard-menu-item is-disabled" aria-disabled="true"${permission}>${core}<span class="dashboard-menu-status">En preparación</span></div>`;
  }

  if (item.href) {
    return `<a class="dashboard-menu-item" data-menu-key="${escapeHtml(item.key)}" href="${escapeHtml(withPreview(item.href))}"${permission}>${core}<img class="dashboard-menu-caret" src="/assets/icons/caret-right.svg" alt="" aria-hidden="true"></a>`;
  }

  return `<button class="dashboard-menu-item" type="button" data-menu-key="${escapeHtml(item.key)}" data-tone="${escapeHtml(tone)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="dashboard-menu-sheet"${permission}>
    ${core}<img class="dashboard-menu-caret" src="/assets/icons/caret-right.svg" alt="" aria-hidden="true">
  </button>`;
}

function menuGroup(group, index) {
  const expanded = index === 0 ? 'true' : 'false';
  return `<section class="dashboard-menu-group${group.primary ? ' is-primary' : ''}" data-tone="${escapeHtml(group.tone)}">
    ${group.primary ? `<h2 class="dashboard-group-heading">${escapeHtml(group.label)}</h2>` : `<button class="dashboard-group-toggle" type="button" aria-expanded="${expanded}" aria-controls="dashboard-group-${escapeHtml(group.key)}">
      <span>${escapeHtml(group.label)}</span><img src="/assets/icons/caret-down.svg" alt="" aria-hidden="true">
    </button>`}
    <div class="dashboard-menu-list" id="dashboard-group-${escapeHtml(group.key)}"${index === 0 ? '' : ' data-mobile-collapsed="true"'}>
      ${group.items.map(item => menuItem(item, group.tone)).join('')}
    </div>
  </section>`;
}

function findMenuItem(key) {
  for (const group of MENU_GROUPS) {
    const item = group.items.find(candidate => candidate.key === key);
    if (item) return { ...item, tone: group.tone };
  }
  return null;
}

function optionMarkup(option) {
  if (option.disabled) return `<button class="dashboard-dialog-option" type="button" disabled><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span><span class="status-badge">No disponible</span></button>`;
  return `<a class="dashboard-dialog-option" href="${escapeHtml(withPreview(option.href))}"${option.permission ? ` data-permission="${escapeHtml(option.permission)}"` : ''}><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span><img src="/assets/icons/arrow-right.svg" alt="" aria-hidden="true"></a>`;
}

function bindDashboardInteractions(session) {
  const sheet = document.getElementById('dashboard-menu-sheet');
  const sheetTitle = document.getElementById('dashboard-dialog-title');
  const sheetDescription = document.getElementById('dashboard-dialog-description');
  const sheetOptions = document.getElementById('dashboard-dialog-options');
  const sheetClose = document.getElementById('dashboard-sheet-close');

  let trigger = null;
  const background = [...document.querySelectorAll('.dashboard-page,.dashboard-footer,.dashboard-floating-actions')];
  const panel = sheet?.querySelector('[role="dialog"]');
  const closeSheet = () => {
    if (!sheet) return;
    sheet.classList.remove('active'); sheet.setAttribute('aria-hidden', 'true'); sheet.inert = true;
    document.body.style.overflow = ''; background.forEach(node=>node.inert=false); trigger?.setAttribute('aria-expanded','false'); trigger?.focus();
  };
  const positionSheet = () => {
    if(!trigger || !panel || !sheet.classList.contains('active')) return;
    const mobile=window.matchMedia('(max-width: 760px)').matches;
    if(mobile){panel.style.left='';panel.style.top='';return;}
    const rect=trigger.getBoundingClientRect(), width=Math.min(360,window.innerWidth-32);
    panel.style.left=Math.max(16,Math.min(rect.left,window.innerWidth-width-16))+'px';
    panel.style.top=Math.max(16,Math.min(rect.bottom+8,window.innerHeight-panel.offsetHeight-16))+'px';
  };
  const openSheet = (item, button, keyboard = false) => {
    if (!sheet || !sheetTitle || !sheetOptions) return;
    sheet.classList.toggle('keyboard-open', keyboard);
    trigger=button;sheetTitle.textContent=item.label;sheetDescription.textContent='';
    sheetOptions.innerHTML=(item.options || []).map(optionMarkup).join('');
    filterByPermission(sheetOptions.querySelectorAll('[data-permission]'),session);
    sheet.inert=false;sheet.setAttribute('aria-hidden','false');sheet.classList.add('active');
    button.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';positionSheet();
    background.forEach(node=>node.inert=true);
    const focusOptions = () => {
      if (sheet.classList.contains('active') && !panel.contains(document.activeElement)) {
        (sheetOptions.querySelector('a:not([hidden])') || sheetClose)?.focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(focusOptions);
    // Visibility transitions can defer focusability until the opening motion ends.
    setTimeout(focusOptions, 220);
  };
  window.addEventListener('resize',positionSheet);
  sheet.inert=true;
  sheet.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const nodes=[...panel.querySelectorAll('button:not([hidden]), a:not([hidden])')];
    const first=nodes[0],last=nodes.at(-1);
    if(!panel.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();return;}
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  document.querySelectorAll('button.dashboard-menu-item').forEach(button => {
    button.addEventListener('click', event => { const item=findMenuItem(button.dataset.menuKey);if(item)openSheet(item,button,event.detail===0); });
  });

  document.querySelectorAll('.dashboard-group-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      if (!window.matchMedia('(max-width: 760px)').matches) return;
      const panel = document.getElementById(toggle.getAttribute('aria-controls'));
      const nextExpanded = toggle.getAttribute('aria-expanded') !== 'true';
      if (nextExpanded) {
        document.querySelectorAll('.dashboard-group-toggle').forEach(otherToggle => {
          if (otherToggle === toggle) return;
          otherToggle.setAttribute('aria-expanded', 'false');
          const otherPanel = document.getElementById(otherToggle.getAttribute('aria-controls'));
          if (otherPanel) otherPanel.dataset.mobileCollapsed = 'true';
        });
      }
      toggle.setAttribute('aria-expanded', String(nextExpanded));
      if (panel) panel.dataset.mobileCollapsed = String(!nextExpanded);
    });
  });

  sheet?.addEventListener('click', event => {
    if (event.target === sheet) closeSheet();
  });
  sheetClose?.addEventListener('click', closeSheet);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sheet?.classList.contains('active')) closeSheet();
  });

  filterByPermission(document.querySelectorAll('[data-permission]'), session);
}

guardPage({
  permission: 'app.access',
  activeKey: 'inicio',
  title: 'Maddy',
  async render({ session, content }) {
    const moment = dayPart();
    const year = new Date().getFullYear();
    content.innerHTML = `<section class="dashboard-page">
      <header class="home-brand" aria-label="Maddy by Maderarte"><img class="home-maddy-logo" src="/assets/brand/maddy-signature.svg" alt="Maddy" width="120" height="62"><span class="home-endorsement">by <strong>Maderarte</strong></span></header>
      <section class="home-hero" aria-labelledby="dashboard-greeting">
        <div class="home-greeting"><p>${escapeHtml(formattedDate())}</p><h1 id="dashboard-greeting">${escapeHtml(moment.greeting)},<br>${escapeHtml(firstName(session.profile))}.</h1></div>
        <img class="home-interior" src="/assets/interiors/living-room-morning.webp" alt="Sala de Maderarte" fetchpriority="high">
      </section>
      <div class="dashboard-groups">${menuGroup(MENU_GROUPS[0],0)}</div>
      <section class="home-today" id="home-today" aria-label="Agenda de hoy"></section>
      <nav class="home-tools" aria-label="Más herramientas">${MENU_GROUPS[1].items.map(item=>menuItem(item,'quiet')).join('')}</nav>
    </section>
    <footer class="dashboard-footer" aria-label="Información de Maderarte">
      <img class="dashboard-footer-seal" src="/assets/brand/maderarte-logo-2026.webp" alt="" aria-hidden="true">
      <p class="dashboard-footer-title">Maddy · by Maderarte</p>
      <span class="dashboard-footer-version">VERSIÓN ${escapeHtml(APP_CONFIG.version)} &copy; ${year}</span>
    </footer>
    <div class="dashboard-sheet-overlay" id="dashboard-menu-sheet" aria-hidden="true">
      <section class="dashboard-sheet-content" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title">
        <div class="dashboard-sheet-handle" aria-hidden="true"></div>
        <div class="dashboard-dialog-header"><div><h2 id="dashboard-dialog-title"></h2><p id="dashboard-dialog-description"></p></div><button class="dashboard-dialog-close" id="dashboard-sheet-close" type="button" aria-label="Cerrar"><img src="/assets/icons/x.svg" alt="" aria-hidden="true"></button></div>
        <div class="dashboard-dialog-options" id="dashboard-dialog-options"></div>
      </section>
    </div>`;
    // Agenda already owns reminders on this home; do not duplicate it with a bell.
    document.getElementById('dashboard-notifications-button')?.remove();
    document.getElementById('dashboard-notifications-popover')?.remove();
    bindDashboardInteractions(session);
    mountToday(document.getElementById('home-today'),session);
  }
});

