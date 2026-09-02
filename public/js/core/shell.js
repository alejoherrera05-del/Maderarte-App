import { APP_CONFIG, withPreview } from './config.js';
import { logout } from './auth.js';
import { escapeHtml, initials, safeInternalUrl } from './format.js';
import { filterByPermission } from './permissions.js';

const NAV_ITEMS = Object.freeze([
  { key: 'inicio', label: 'Inicio', short: 'Inicio', icon: 'house', href: '/index.html', permission: 'app.access' },
  { key: 'clientes', label: 'Clientes', short: 'Clientes', icon: 'users-three', href: '/clientes.html', permission: 'clientes.read' },
  { key: 'ordenes', label: 'Órdenes de pedido', short: 'Órdenes', icon: 'clipboard-text', href: '/ordenes.html', permission: 'ordenes.read' }
]);

function iconPath(icon) {
  return `/assets/icons/${icon}.svg`;
}

function navLink(item, activeKey, mobile = false) {
  const current = item.key === activeKey ? ' aria-current="page"' : '';
  const permission = item.permission ? ` data-permission="${escapeHtml(item.permission)}"` : '';
  const href = escapeHtml(withPreview(item.href));
  const icon = `<img src="${escapeHtml(iconPath(item.icon))}" alt="" aria-hidden="true">`;
  if (mobile) return `<a href="${href}"${current}${permission}><span class="mobile-nav-icon">${icon}</span><span>${escapeHtml(item.short)}</span></a>`;
  return `<a class="nav-link" href="${href}"${current}${permission}><span class="nav-icon">${icon}</span><span>${escapeHtml(item.label)}</span></a>`;
}

function brandMarkup(classPrefix = 'shell') {
  return `<img class="${classPrefix}-brand-logo" src="/assets/brand/maderarte-logo-2026.webp" alt="Logo de Maderarte">
    <span class="${classPrefix}-brand-copy"><img class="${classPrefix}-brand-wordmark" src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"><span class="${classPrefix}-brand-subtitle">Centro operativo</span></span>`;
}

function profileMenuContent(profile, prefix) {
  return `<div class="dashboard-profile-menu" id="${prefix}-profile-menu" role="menu" hidden>
      <div class="dashboard-profile-summary"><span class="user-avatar">${escapeHtml(initials(profile.name))}</span><span><strong>${escapeHtml(profile.name || profile.email)}</strong><small>${escapeHtml(profile.role || 'Usuario')}</small></span></div>
      <a role="menuitem" href="${escapeHtml(withPreview('/perfil.html'))}" data-permission="perfil.read"><img src="/assets/icons/user-circle.svg" alt="" aria-hidden="true"><span>Mi perfil</span></a>
      <a role="menuitem" href="${escapeHtml(withPreview('/configuracion.html'))}" data-permission="config.read"><img src="/assets/icons/gear-six.svg" alt="" aria-hidden="true"><span>Configuración</span></a>
      <button role="menuitem" id="${prefix}-logout-button" type="button"><img src="/assets/icons/arrow-right.svg" alt="" aria-hidden="true"><span>Cerrar sesión</span></button>
    </div>`;
}

function dashboardControlsMarkup(profile) {
  return `<div class="dashboard-floating-actions" aria-label="Acciones rápidas">
      <button class="dashboard-circle-action" id="dashboard-notifications-button" type="button" aria-label="Notificaciones" aria-haspopup="true" aria-expanded="false">
        <img src="/assets/icons/bell-simple.svg" alt="" aria-hidden="true">
      </button>
      <div class="dashboard-notifications-popover" id="dashboard-notifications-popover" hidden>
        <strong>Notificaciones</strong>
        <p>No hay notificaciones nuevas.</p>
      </div>
      <button class="dashboard-circle-action dashboard-profile-orb" id="dashboard-profile-button" type="button" aria-label="Abrir mi perfil" aria-haspopup="menu" aria-expanded="false">
        <span class="dashboard-profile-initials">${escapeHtml(initials(profile.name))}</span>
      </button>
      ${profileMenuContent(profile, 'dashboard')}
    </div>`;
}

function interiorControlsMarkup(profile) {
  return `<div class="interior-system-actions" aria-label="Acciones del sistema">
      <button class="interior-circle-action" id="interior-notifications-button" type="button" aria-label="Notificaciones" aria-haspopup="true" aria-expanded="false">
        <img src="/assets/icons/bell-simple.svg" alt="" aria-hidden="true">
      </button>
      <div class="interior-notifications-popover" id="interior-notifications-popover" hidden>
        <strong>Notificaciones</strong><p>No hay notificaciones nuevas.</p>
      </div>
      <button class="interior-circle-action interior-profile-orb" id="interior-profile-button" type="button" aria-label="Abrir mi perfil" aria-haspopup="menu" aria-expanded="false">
        <span>${escapeHtml(initials(profile.name))}</span>
      </button>
      ${profileMenuContent(profile, 'interior')}
    </div>`;
}

export function mountShell({ session, activeKey, title, subtitle = 'Operación interna de Maderarte' }) {
  const root = document.getElementById('app-shell');
  if (!root) throw new Error('Falta el contenedor #app-shell.');
  if (activeKey === 'inicio') return mountDashboardShell({ root, session });

  const nav = NAV_ITEMS.map(item => navLink(item, activeKey)).join('');
  const mobileNav = NAV_ITEMS.map(item => navLink(item, activeKey, true)).join('');
  root.className = 'app-shell interior-app-shell';

  root.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
      <a class="brand-block" href="${escapeHtml(withPreview('/index.html'))}">
        ${brandMarkup('shell')}
      </a>
      <nav class="side-nav"><span class="nav-label">Navegación</span>${nav}</nav>
      <div class="sidebar-footer"><div class="connection-box"><strong>Centro operativo</strong><span>${session.offline ? 'Conexión limitada' : 'Sesión activa'}</span></div></div>
    </aside>
    <button class="sidebar-overlay" id="sidebar-overlay" type="button" aria-label="Cerrar menú"></button>
    <main class="app-main" id="main-content">
      <header class="topbar interior-topbar">
        <div class="topbar-actions interior-page-context">
          <button class="icon-button mobile-menu-button" id="mobile-menu-button" type="button" aria-label="Abrir menú">☰</button>
          <div class="topbar-context"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
        </div>
        ${interiorControlsMarkup(session.profile)}
      </header>
      <div id="page-content"></div>
    </main>
    <nav class="mobile-nav" aria-label="Navegación móvil">${mobileNav}</nav>`;

  filterByPermission(root.querySelectorAll('[data-permission]'), session);
  bindShellEvents();
  bindProfileMenu('interior');
  bindNotifications('interior');
  return document.getElementById('page-content');
}

function mountDashboardShell({ root, session }) {
  root.className = 'app-shell dashboard-app-shell';
  root.innerHTML = `
    <main class="dashboard-shell" id="main-content">
      ${dashboardControlsMarkup(session.profile)}
      <div id="page-content"></div>
    </main>`;

  filterByPermission(root.querySelectorAll('[data-permission]'), session);
  bindProfileMenu('dashboard');
  bindNotifications('dashboard');
  return document.getElementById('page-content');
}

function bindProfileMenu(prefix) {
  const profileButton = document.getElementById(`${prefix}-profile-button`);
  const profileMenu = document.getElementById(`${prefix}-profile-menu`);
  const closeProfileMenu = () => {
    if (!profileButton || !profileMenu) return;
    profileMenu.hidden = true;
    profileButton.setAttribute('aria-expanded', 'false');
  };
  profileButton?.addEventListener('click', event => {
    event.stopPropagation();
    const nextOpen = profileMenu?.hidden ?? false;
    if (profileMenu) profileMenu.hidden = !nextOpen;
    profileButton.setAttribute('aria-expanded', String(nextOpen));
  });
  document.addEventListener('click', event => {
    if (!profileMenu?.hidden && !profileMenu.contains(event.target) && !profileButton?.contains(event.target)) closeProfileMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeProfileMenu();
  });
  document.getElementById(`${prefix}-logout-button`)?.addEventListener('click', async () => {
    await logout();
    window.location.assign(withPreview(APP_CONFIG.loginPath));
  });
}

function bindNotifications(prefix) {
  const button = document.getElementById(`${prefix}-notifications-button`);
  const popover = document.getElementById(`${prefix}-notifications-popover`);
  const close = () => {
    if (!button || !popover) return;
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };
  button?.addEventListener('click', event => {
    event.stopPropagation();
    const nextOpen = popover?.hidden ?? false;
    if (popover) popover.hidden = !nextOpen;
    button.setAttribute('aria-expanded', String(nextOpen));
  });
  document.addEventListener('click', event => {
    if (!popover?.hidden && !popover.contains(event.target) && !button?.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}

function bindShellEvents() {
  const menuButton = document.getElementById('mobile-menu-button');
  const overlay = document.getElementById('sidebar-overlay');
  const closeMenu = () => document.body.classList.remove('menu-open');
  menuButton?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
  overlay?.addEventListener('click', closeMenu);
  document.querySelectorAll('.sidebar a').forEach(link => link.addEventListener('click', closeMenu));
}

export function initializeTheme() {
  document.documentElement.dataset.theme = 'light';
}

export function bindLogout(buttonId = 'logout-button') {
  document.getElementById(buttonId)?.addEventListener('click', async () => {
    await logout();
    window.location.assign(withPreview(APP_CONFIG.loginPath));
  });
}

export function redirectAfterLogin(rawNext) {
  const target = safeInternalUrl(rawNext, APP_CONFIG.homePath);
  window.location.assign(withPreview(target));
}
