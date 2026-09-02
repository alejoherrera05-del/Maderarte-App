import { escapeHtml } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardPage } from '../core/page-guard.js';
import { filterByPermission } from '../core/permissions.js';

const MENU_GROUPS = Object.freeze([
  {
    key: 'comercial', label: 'Comercial', tone: 'orange', items: [
      { key: 'clientes', label: 'Clientes', description: 'Directorio y seguimiento', icon: 'users-three', permission: 'clientes.read', options: [
        { label: 'Directorio de clientes', description: 'Consulta y seguimiento comercial', disabled: true },
        { label: 'Nuevo cliente', description: 'Disponible cuando se habiliten las escrituras', disabled: true }
      ] },
      { key: 'cotizaciones', label: 'Cotizaciones', description: 'Crear y hacer seguimiento', icon: 'file-text', permission: 'cotizaciones.read', options: [
        { label: 'Consultar cotizaciones', description: 'Historial comercial', disabled: true },
        { label: 'Nueva cotización', description: 'Disponible en la etapa de escrituras', disabled: true }
      ] },
      { key: 'ordenes', label: 'Órdenes de pedido', description: 'Pedidos, estado y detalle', icon: 'clipboard-text', permission: 'ordenes.read', options: [
        { label: 'Ver órdenes de pedido', description: 'Abrir el listado y sus expedientes', href: '/ordenes.html' },
        { label: 'Nueva orden de pedido', description: 'Disponible cuando se habiliten las escrituras', disabled: true }
      ] },
      { key: 'abonos', label: 'Abonos', description: 'Pagos y saldos', icon: 'wallet', permission: 'abonos.read', options: [
        { label: 'Consultar abonos', description: 'Pagos asociados a cada OP', disabled: true },
        { label: 'Registrar abono', description: 'Disponible en la etapa de escrituras', disabled: true }
      ] }
    ]
  },
  {
    key: 'operacion', label: 'Operación', tone: 'graphite', items: [
      { key: 'produccion', label: 'Producción', description: 'Avance por etapa', icon: 'stack', permission: 'produccion.read', options: [
        { label: 'Seguimiento de producción', description: 'Estado de los productos por OP', disabled: true },
        { label: 'Actualizar etapa', description: 'Disponible en la etapa de escrituras', disabled: true }
      ] },
      { key: 'remisiones', label: 'Remisiones', description: 'Entregas y soportes', icon: 'truck', permission: 'remisiones.read', options: [
        { label: 'Consultar remisiones', description: 'Entregas vinculadas a cada OP', disabled: true },
        { label: 'Nueva remisión', description: 'Disponible en la etapa de escrituras', disabled: true }
      ] },
      { key: 'agenda', label: 'Agenda', description: 'Compromisos y fechas', icon: 'calendar-dots', permission: 'agenda.read', options: [
        { label: 'Ver agenda', description: 'Entregas, visitas y tareas', disabled: true },
        { label: 'Crear compromiso', description: 'Disponible en una siguiente etapa', disabled: true }
      ] }
    ]
  },
  {
    key: 'gestion', label: 'Gestión', tone: 'gold', items: [
      { key: 'documentos', label: 'Documentos', description: 'Archivos y soportes', icon: 'folder-open', permission: 'documentos.read', options: [
        { label: 'Consultar documentos', description: 'Archivos asociados a clientes y OP', disabled: true }
      ] },
      { key: 'reportes', label: 'Reportes', description: 'Lectura de la operación', icon: 'chart-bar', permission: 'reportes.read', options: [
        { label: 'Reportes operativos', description: 'Disponible en una siguiente etapa', disabled: true }
      ] },
      { key: 'configuracion', label: 'Configuración', description: 'Preferencias de la app', icon: 'sliders-horizontal', permission: 'config.read', options: [
        { label: 'Configuración del sistema', description: 'Estado, usuarios y parámetros', href: '/configuracion.html' },
        { label: 'Mi perfil', description: 'Cuenta, rol y dispositivo', href: '/perfil.html' }
      ] }
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
  return `<button class="dashboard-menu-item" type="button" data-menu-key="${escapeHtml(item.key)}" data-tone="${escapeHtml(tone)}"${permission}>
    <span class="dashboard-menu-icon"><img src="/assets/icons/${escapeHtml(item.icon)}.svg" alt="" aria-hidden="true"></span>
    <span class="dashboard-menu-copy"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.description)}</span></span>
    <img class="dashboard-menu-caret" src="/assets/icons/caret-right.svg" alt="" aria-hidden="true">
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
  if (option.disabled) return `<button class="dashboard-dialog-option" type="button" disabled><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span><span class="status-badge">Próximamente</span></button>`;
  return `<a class="dashboard-dialog-option" href="${escapeHtml(withPreview(option.href))}"><span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span><img src="/assets/icons/arrow-right.svg" alt="" aria-hidden="true"></a>`;
}

function bindDashboardInteractions(session) {
  const dialog = document.getElementById('dashboard-menu-dialog');
  const dialogTitle = document.getElementById('dashboard-dialog-title');
  const dialogDescription = document.getElementById('dashboard-dialog-description');
  const dialogOptions = document.getElementById('dashboard-dialog-options');

  document.querySelectorAll('.dashboard-menu-item').forEach(button => {
    button.addEventListener('click', () => {
      const item = findMenuItem(button.dataset.menuKey);
      if (!item || !dialog || !dialogTitle || !dialogDescription || !dialogOptions) return;
      dialog.dataset.tone = item.tone;
      dialogTitle.textContent = item.label;
      dialogDescription.textContent = item.description;
      dialogOptions.innerHTML = item.options.map(optionMarkup).join('');
      dialog.showModal();
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

  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  filterByPermission(document.querySelectorAll('[data-permission]'), session);
}

guardPage({
  permission: 'app.access',
  activeKey: 'inicio',
  title: 'Centro operativo',
  async render({ session, content }) {
    const moment = dayPart();
    content.innerHTML = `<section class="dashboard-page">
      <section class="dashboard-hero" data-day-part="${escapeHtml(moment.key)}" aria-labelledby="dashboard-greeting">
        <div class="dashboard-hero-copy"><p>${escapeHtml(formattedDate())}</p><h1 id="dashboard-greeting">${escapeHtml(moment.greeting)}, ${escapeHtml(firstName(session.profile))}</h1></div>
      </section>
      <div class="dashboard-groups">${MENU_GROUPS.map(menuGroup).join('')}</div>
    </section>
    <footer class="dashboard-footer" aria-label="Información de Maderarte">
      <img class="dashboard-footer-seal" src="/assets/brand/maderarte-logo-2026.webp" alt="" aria-hidden="true">
      <p>Muebles con un estilo diferente para cada cliente.</p>
      <span>Maderarte APP 1.0</span>
    </footer>
    <dialog class="dashboard-menu-dialog" id="dashboard-menu-dialog" aria-labelledby="dashboard-dialog-title">
      <div class="dashboard-dialog-header"><div><h2 id="dashboard-dialog-title"></h2><p id="dashboard-dialog-description"></p></div><form method="dialog"><button class="dashboard-dialog-close" type="submit" aria-label="Cerrar"><img src="/assets/icons/x.svg" alt="" aria-hidden="true"></button></form></div>
      <div class="dashboard-dialog-options" id="dashboard-dialog-options"></div>
    </dialog>`;
    bindDashboardInteractions(session);
  }
});
