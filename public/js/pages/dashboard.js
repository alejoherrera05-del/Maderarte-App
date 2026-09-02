import { APP_CONFIG, withPreview } from '../core/config.js';
import { escapeHtml } from '../core/format.js';
import { guardPage } from '../core/page-guard.js';
import { filterByPermission } from '../core/permissions.js';

const MENU_GROUPS = Object.freeze([
  {
    key: 'comercial', label: 'Comercial', tone: 'orange', items: [
      { key: 'clientes', label: 'Clientes', description: 'Directorio y seguimiento', icon: 'users-three', permission: 'clientes.read', available: false },
      { key: 'cotizaciones', label: 'Cotizaciones', description: 'Propuestas y seguimiento', icon: 'file-text', permission: 'cotizaciones.read', available: false },
      { key: 'ordenes', label: 'Órdenes de pedido', description: 'Pedidos, estado y detalle', icon: 'clipboard-text', permission: 'ordenes.read', options: [
        { label: 'Ver órdenes de pedido', description: 'Abrir el listado y sus expedientes', href: '/ordenes.html' },
        { label: 'Nueva orden de pedido', description: 'Se habilitará en la etapa de escrituras', disabled: true }
      ] },
      { key: 'abonos', label: 'Abonos', description: 'Pagos y saldos', icon: 'wallet', permission: 'abonos.read', available: false }
    ]
  },
  {
    key: 'operacion', label: 'Operación', tone: 'graphite', items: [
      { key: 'produccion', label: 'Producción', description: 'Avance por etapa', icon: 'stack', permission: 'produccion.read', available: false },
      { key: 'remisiones', label: 'Remisiones', description: 'Entregas y soportes', icon: 'truck', permission: 'remisiones.read', available: false },
      { key: 'agenda', label: 'Agenda', description: 'Compromisos y fechas', icon: 'calendar-dots', permission: 'agenda.read', available: false }
    ]
  },
  {
    key: 'gestion', label: 'Gestión', tone: 'gold', items: [
      { key: 'documentos', label: 'Documentos', description: 'Archivos y soportes', icon: 'folder-open', permission: 'documentos.read', available: false },
      { key: 'reportes', label: 'Reportes', description: 'Lectura de la operación', icon: 'chart-bar', permission: 'reportes.read', available: false }
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
    return `<div class="dashboard-menu-item is-disabled" aria-disabled="true"${permission}>${core}<span class="dashboard-menu-status">Próximamente</span></div>`;
  }

  return `<button class="dashboard-menu-item" type="button" data-menu-key="${escapeHtml(item.key)}" data-tone="${escapeHtml(tone)}"${permission}>
    ${core}<img class="dashboard-menu-caret" src="/assets/icons/caret-right.svg" alt="" aria-hidden="true">
  </button>`;
}

function menuGroup(group, index) {
  const expanded = index === 0 ? 'true' : 'false';
  return `<section class="dashboard-menu-group" data-tone="${escapeHtml(group.tone)}">
    <button class="dashboard-group-toggle" type="button" aria-expanded="${expanded}" aria-controls="dashboard-group-${escapeHtml(group.key)}">
      <span>${escapeHtml(group.label)}</span><img src="/assets/icons/caret-down.svg" alt="" aria-hidden="true">
    </button>
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
  return `<a class="dashboard-dialog-option" href="${escapeHtml(withPreview(option.href))}"><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span><img src="/assets/icons/arrow-right.svg" alt="" aria-hidden="true"></a>`;
}

function bindDashboardInteractions(session) {
  const sheet = document.getElementById('dashboard-menu-sheet');
  const sheetTitle = document.getElementById('dashboard-dialog-title');
  const sheetDescription = document.getElementById('dashboard-dialog-description');
  const sheetOptions = document.getElementById('dashboard-dialog-options');
  const sheetClose = document.getElementById('dashboard-sheet-close');

  const closeSheet = () => {
    if (!sheet) return;
    sheet.classList.remove('active');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  const openSheet = item => {
    if (!sheet || !sheetTitle || !sheetDescription || !sheetOptions) return;
    sheet.dataset.tone = item.tone;
    sheetTitle.textContent = item.label;
    sheetDescription.textContent = item.description;
    sheetOptions.innerHTML = (item.options || []).map(optionMarkup).join('');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => sheet.classList.add('active'));
    window.setTimeout(() => sheetClose?.focus(), 220);
  };

  document.querySelectorAll('button.dashboard-menu-item').forEach(button => {
    button.addEventListener('click', () => {
      const item = findMenuItem(button.dataset.menuKey);
      if (item) openSheet(item);
    });
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
  title: 'Centro operativo',
  async render({ session, content }) {
    const moment = dayPart();
    const year = new Date().getFullYear();
    content.innerHTML = `<section class="dashboard-page">
      <section class="dashboard-hero" data-day-part="${escapeHtml(moment.key)}" aria-labelledby="dashboard-greeting">
        <div class="dashboard-hero-copy"><p>${escapeHtml(formattedDate())}</p><h1 id="dashboard-greeting">${escapeHtml(moment.greeting)}, ${escapeHtml(firstName(session.profile))}</h1></div>
      </section>
      <div class="dashboard-groups">${MENU_GROUPS.map(menuGroup).join('')}</div>
    </section>
    <footer class="dashboard-footer" aria-label="Información de Maderarte">
      <img class="dashboard-footer-seal" src="/assets/brand/maderarte-logo-2026.webp" alt="" aria-hidden="true">
      <p class="dashboard-footer-title">Maderarte · Centro operativo</p>
      <span class="dashboard-footer-version">VERSIÓN ${escapeHtml(APP_CONFIG.version)} &copy; ${year}</span>
    </footer>
    <div class="dashboard-sheet-overlay" id="dashboard-menu-sheet" aria-hidden="true">
      <section class="dashboard-sheet-content" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title">
        <div class="dashboard-sheet-handle" aria-hidden="true"></div>
        <div class="dashboard-dialog-header"><div><h2 id="dashboard-dialog-title"></h2><p id="dashboard-dialog-description"></p></div><button class="dashboard-dialog-close" id="dashboard-sheet-close" type="button" aria-label="Cerrar"><img src="/assets/icons/x.svg" alt="" aria-hidden="true"></button></div>
        <div class="dashboard-dialog-options" id="dashboard-dialog-options"></div>
      </section>
    </div>`;
    bindDashboardInteractions(session);
  }
});
