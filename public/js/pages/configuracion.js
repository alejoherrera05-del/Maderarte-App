import { apiRequest } from '../core/api.js';
import { APP_CONFIG, withPreview } from '../core/config.js';
import { previewApiData } from '../core/auth.js';
import { dateTime, escapeHtml, humanizeCode } from '../core/format.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { hasPermission } from '../core/permissions.js';

async function request(action, payload = {}) {
  return previewApiData(action) || apiRequest(action, payload);
}

function toast(message) {
  const node = document.getElementById('cfg-toast');
  node.textContent = message;
  node.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove('show'), 2200);
}

function usersTable(items) {
  if (!items.length) return '<div class="cfg-state">No hay usuarios autorizados para mostrar.</div>';
  return `<div class="cfg-users"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sede</th><th>Estado</th><th>Último acceso</th></tr></thead><tbody>${items.map(item => `<tr><td class="cfg-user-name">${escapeHtml(item.name || '—')}</td><td>${escapeHtml(item.email || '—')}</td><td>${escapeHtml(humanizeCode(item.role))}</td><td>${escapeHtml(item.mainBranch || '—')}</td><td>${escapeHtml(humanizeCode(item.status))}</td><td>${escapeHtml(dateTime(item.lastAccess))}</td></tr>`).join('')}</tbody></table></div>`;
}

function invitationForm() {
  return `<form class="cfg-form" id="invitation-form"><div class="cfg-form-grid"><div class="cfg-field"><label for="invitation-name">Nombre completo</label><input id="invitation-name" required maxlength="160"></div><div class="cfg-field"><label for="invitation-email">Correo</label><input id="invitation-email" type="email" required autocomplete="off"></div><div class="cfg-field"><label for="invitation-role">Rol</label><select id="invitation-role"><option value="VENDEDOR">Vendedor</option><option value="BODEGA_LOGISTICA">Bodega y logística</option><option value="CONSULTA">Consulta</option><option value="ADMINISTRADOR">Administrador</option></select></div><div class="cfg-field"><label for="invitation-main-branch">Sede principal</label><select id="invitation-main-branch"><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div><div class="cfg-field"><label>Sedes permitidas</label><div class="cfg-checks"><label><input type="checkbox" name="invitation-branch" value="MP" checked> Principal</label><label><input type="checkbox" name="invitation-branch" value="TP"> Terraplaza</label></div></div><div class="cfg-field"><label>&nbsp;</label><button class="cfg-submit" id="invitation-submit" type="submit">Crear invitación</button></div></div></form><div class="cfg-output" id="invitation-output" hidden><input id="invitation-link" readonly><button class="cfg-copy-button" id="copy-invitation-button" type="button">Copiar enlace</button></div>`;
}

function renderShell(root, canManageUsers) {
  root.innerHTML = `<header class="cfg-header"><div class="cfg-header-inner"><a class="cfg-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Volver al inicio"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a><div class="cfg-brand"><strong>Configuración</strong><span>Maderarte App</span></div><a class="cfg-round" href="${escapeHtml(withPreview('/perfil.html'))}" aria-label="Abrir mi perfil"><img src="/assets/icons/user-circle.svg" alt="" aria-hidden="true"></a></div></header>
  <main class="cfg-shell"><section class="cfg-hero"><h1>Configuración</h1><p>Cuenta, sistema, usuarios e integraciones en un solo lugar.</p></section><div id="cfg-content"><div class="cfg-list"><div class="cfg-state">Comprobando el sistema…</div></div></div>${canManageUsers ? '<div id="cfg-invite-slot"></div>' : ''}</main><div class="cfg-toast" id="cfg-toast" role="status"></div>`;
}

function renderContent(system, users, canManageUsers) {
  document.getElementById('cfg-content').innerHTML = `<section class="cfg-group"><h2 class="cfg-group-title">Sistema</h2><div class="cfg-list"><div class="cfg-row"><span class="cfg-icon">MA</span><span class="cfg-copy"><strong>Modo operativo</strong><span>Estado actual del sistema</span></span><span class="cfg-value warning">${escapeHtml(system.mode || 'PREPARACION')}</span></div><div class="cfg-row"><span class="cfg-icon gold">v</span><span class="cfg-copy"><strong>Versión</strong><span>Versión instalada</span></span><span class="cfg-value">${escapeHtml(system.appVersion || APP_CONFIG.version)}</span></div><div class="cfg-row"><span class="cfg-icon green">✓</span><span class="cfg-copy"><strong>Escrituras comerciales</strong><span>Protección de la base operativa</span></span><span class="cfg-value success">${escapeHtml(system.commercialWrites || 'DESHABILITADAS')}</span></div></div></section>
  <section class="cfg-group"><h2 class="cfg-group-title">Base operativa</h2><div class="cfg-list"><div class="cfg-row"><span class="cfg-icon">BD</span><span class="cfg-copy"><strong>Base de datos</strong><span>Fuente oficial de Maderarte</span></span><span class="cfg-value">${escapeHtml(system.spreadsheetName || 'Base de Datos Maderarte App')}</span></div><div class="cfg-row"><span class="cfg-icon gold">CL</span><span class="cfg-copy"><strong>Clientes</strong><span>Registros disponibles</span></span><span class="cfg-value">${Number(system.counts?.clients || 0)}</span></div><div class="cfg-row"><span class="cfg-icon">OP</span><span class="cfg-copy"><strong>Órdenes</strong><span>Órdenes de pedido registradas</span></span><span class="cfg-value">${Number(system.counts?.orders || 0)}</span></div></div></section>
  <section class="cfg-group"><h2 class="cfg-group-title">Integraciones</h2><div class="cfg-list"><div class="cfg-row"><span class="cfg-icon gold">WA</span><span class="cfg-copy"><strong>WhatsApp Maderarte</strong><span>Infraestructura aislada para esta marca</span></span><span class="cfg-value">Pendiente</span></div></div></section>
  <section class="cfg-group"><h2 class="cfg-group-title">Usuarios autorizados</h2><div class="cfg-list">${usersTable(users)}</div></section>`;
  if (canManageUsers) document.getElementById('cfg-invite-slot').innerHTML = `<section class="cfg-group"><h2 class="cfg-group-title">Invitar usuario</h2><div class="cfg-list">${invitationForm()}</div></section>`;
}

function bindInvitation() {
  const form = document.getElementById('invitation-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('invitation-submit');
    button.disabled = true;
    button.textContent = 'Creando…';
    try {
      if (APP_CONFIG.preview.enabled) throw new Error('La vista local no crea invitaciones.');
      const branches = Array.from(document.querySelectorAll('input[name="invitation-branch"]:checked')).map(input => input.value);
      const response = await apiRequest('INVITACION_CREAR', { name: document.getElementById('invitation-name').value.trim(), email: document.getElementById('invitation-email').value.trim(), role: document.getElementById('invitation-role').value, mainBranch: document.getElementById('invitation-main-branch').value, branches });
      document.getElementById('invitation-link').value = String(response.data?.activationUrl || '');
      document.getElementById('invitation-output').hidden = false;
      form.reset();
      toast('Invitación creada');
    } catch (error) {
      toast(error.message || 'No fue posible crear la invitación.');
    } finally {
      button.disabled = false;
      button.textContent = 'Crear invitación';
    }
  });
  document.getElementById('copy-invitation-button')?.addEventListener('click', async () => {
    const input = document.getElementById('invitation-link');
    try { await navigator.clipboard.writeText(input.value); toast('Enlace copiado'); }
    catch { input.select(); toast('Enlace seleccionado'); }
  });
}

guardStandalonePage({
  permission: 'config.read',
  async render({ session }) {
    const root = document.getElementById('config-app');
    const canManageUsers = hasPermission(session, 'users.manage');
    renderShell(root, canManageUsers);
    root.hidden = false;
    try {
      const [systemResponse, usersResponse] = await Promise.all([request('SISTEMA_ESTADO'), request('USUARIOS_LISTAR')]);
      renderContent(systemResponse.data || {}, Array.isArray(usersResponse.data?.items) ? usersResponse.data.items : [], canManageUsers);
      bindInvitation();
    } catch (error) {
      document.getElementById('cfg-content').innerHTML = `<section class="cfg-group"><h2 class="cfg-group-title">Sistema</h2><div class="cfg-list"><div class="cfg-state">${escapeHtml(error.message || 'No fue posible consultar la configuración.')}</div></div></section>`;
    }
  }
});
