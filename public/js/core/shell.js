import { APP_CONFIG, withPreview } from './config.js';
import { logout } from './auth.js';
import { escapeHtml, initials, safeInternalUrl } from './format.js';
import { filterByPermission } from './permissions.js';

const NAV_ITEMS = Object.freeze([
  { key: 'inicio', label: 'Inicio', short: 'Inicio', icon: 'IN', href: '/index.html', permission: 'app.access' },
  { key: 'ordenes', label: 'Órdenes de pedido', short: 'Órdenes', icon: 'OP', href: '/ordenes.html', permission: 'ordenes.read' },
  { key: 'perfil', label: 'Mi perfil', short: 'Perfil', icon: 'MI', href: '/perfil.html', permission: 'perfil.read' },
  { key: 'configuracion', label: 'Configuración', short: 'Ajustes', icon: 'CF', href: '/configuracion.html', permission: 'config.read' }
]);

function navLink(item, activeKey, mobile = false) {
  const current = item.key === activeKey ? ' aria-current="page"' : '';
  const permission = item.permission ? ` data-permission="${escapeHtml(item.permission)}"` : '';
  const href = escapeHtml(withPreview(item.href));
  if (mobile) return `<a href="${href}"${current}${permission}><span>${escapeHtml(item.icon)}</span><span>${escapeHtml(item.short)}</span></a>`;
  return `<a class="nav-link" href="${href}"${current}${permission}><span class="nav-icon">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></a>`;
}

export function mountShell({ session, activeKey, title, subtitle = 'Operación interna de Maderarte' }) {
  const root = document.getElementById('app-shell');
  if (!root) throw new Error('Falta el contenedor #app-shell.');
  if (activeKey === 'inicio') return mountDashboardShell({ root, session });
  const profile = session.profile;
  const nav = NAV_ITEMS.map(item => navLink(item, activeKey)).join('');
  const mobileNav = NAV_ITEMS.map(item => navLink(item, activeKey, true)).join('');

  root.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
      <a class="brand-block" href="${escapeHtml(withPreview('/index.html'))}">
        <span class="brand-copy"><span class="brand-name">MADERARTE</span><span class="brand-subtitle">Centro operativo</span></span>
      </a>
      <nav class="side-nav"><span class="nav-label">Operación</span>${nav}</nav>
      <div class="sidebar-footer"><div class="connection-box"><strong id="connection-label">Base Cero · v${escapeHtml(APP_CONFIG.version)}</strong><span id="connection-detail">${session.offline ? 'Sin conexión · modo limitado' : 'Sesión validada'}</span></div></div>
    </aside>
    <button class="sidebar-overlay" id="sidebar-overlay" type="button" aria-label="Cerrar menú"></button>
    <main class="app-main" id="main-content">
      <header class="topbar">
        <div class="topbar-actions">
          <button class="icon-button mobile-menu-button" id="mobile-menu-button" type="button" aria-label="Abrir menú">☰</button>
          <div class="topbar-context"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
        </div>
        <div class="topbar-actions">
          <button class="icon-button" id="theme-toggle" type="button" aria-label="Cambiar tema">◐</button>
          <a class="user-chip" href="${escapeHtml(withPreview('/perfil.html'))}" aria-label="Abrir perfil">
            <span class="user-avatar">${escapeHtml(initials(profile.name))}</span>
            <span class="user-chip-copy"><strong>${escapeHtml(profile.name || profile.email)}</strong><span>${escapeHtml(profile.role || 'Usuario')}</span></span>
          </a>
        </div>
      </header>
      <div id="page-content"></div>
    </main>
    <nav class="mobile-nav" aria-label="Navegación móvil">${mobileNav}</nav>`;

  filterByPermission(root.querySelectorAll('[data-permission]'), session);
  bindShellEvents();
  return document.getElementById('page-content');
}

function mountDashboardShell({ root, session }) {
  const profile = session.profile;
  document.documentElement.dataset.theme = 'light';
  root.className = 'app-shell dashboard-app-shell';
  root.innerHTML = `
    <main class="dashboard-shell" id="main-content">
      <header class="dashboard-topbar">
        <a class="dashboard-brand" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Maderarte, centro operativo">
          <img class="dashboard-brand-logo" src="/assets/brand/maderarte-logo-2026.webp" alt="Logo de Maderarte">
          <span class="dashboard-brand-copy"><img class="dashboard-brand-wordmark" src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"><span class="dashboard-brand-subtitle">Centro operativo</span></span>
        </a>
        <div class="dashboard-topbar-actions">
          <button class="dashboard-notification-button" type="button" aria-label="Notificaciones">
            <img src="/assets/icons/bell-simple.svg" alt="" aria-hidden="true"><span aria-hidden="true"></span>
          </button>
          <span class="dashboard-topbar-divider" aria-hidden="true"></span>
          <button class="dashboard-profile-button" id="dashboard-profile-button" type="button" aria-label="Abrir mi perfil" aria-haspopup="menu" aria-expanded="false">
            <span>Mi perfil</span><img src="/assets/icons/caret-down.svg" alt="" aria-hidden="true">
          </button>
          <div class="dashboard-profile-menu" id="dashboard-profile-menu" role="menu" hidden>
            <div class="dashboard-profile-summary"><span class="user-avatar">${escapeHtml(initials(profile.name))}</span><span><strong>${escapeHtml(profile.name || profile.email)}</strong><small>${escapeHtml(profile.role || 'Usuario')}</small></span></div>
            <a role="menuitem" href="${escapeHtml(withPreview('/perfil.html'))}"><img src="/assets/icons/user-circle.svg" alt="" aria-hidden="true"><span>Ver mi perfil</span></a>
            <button role="menuitem" id="dashboard-logout-button" type="button"><img src="/assets/icons/arrow-right.svg" alt="" aria-hidden="true"><span>Cerrar sesión</span></button>
          </div>
        </div>
      </header>
      <div id="page-content"></div>
    </main>`;

  bindDashboardShellEvents();
  return document.getElementById('page-content');
}

function bindDashboardShellEvents() {
  const profileButton = document.getElementById('dashboard-profile-button');
  const profileMenu = document.getElementById('dashboard-profile-menu');
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
  document.getElementById('dashboard-logout-button')?.addEventListener('click', async () => {
    await logout();
    window.location.assign(withPreview(APP_CONFIG.loginPath));
  });
}

function bindShellEvents() {
  const menuButton = document.getElementById('mobile-menu-button');
  const overlay = document.getElementById('sidebar-overlay');
  const themeButton = document.getElementById('theme-toggle');
  const closeMenu = () => document.body.classList.remove('menu-open');
  menuButton?.addEventListener('click', () => document.body.classList.toggle('menu-open'));
  overlay?.addEventListener('click', closeMenu);
  document.querySelectorAll('.sidebar a').forEach(link => link.addEventListener('click', closeMenu));
  themeButton?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(APP_CONFIG.themeKey, next);
  });
}

export function initializeTheme() {
  const stored = window.localStorage.getItem(APP_CONFIG.themeKey);
  const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = stored === 'dark' || stored === 'light' ? stored : preferred;
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
