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
