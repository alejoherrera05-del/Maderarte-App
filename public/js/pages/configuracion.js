import { apiRequest } from '../core/api.js';
import { APP_CONFIG } from '../core/config.js';
import { previewApiData } from '../core/auth.js';
import { dateTime, escapeHtml, humanizeCode } from '../core/format.js';
import { guardPage } from '../core/page-guard.js';
import { hasPermission } from '../core/permissions.js';
import { emptyState, errorState, loadingState, setBusy, statusBadge, toast } from '../core/ui.js';

async function request(action, payload = {}) {
  return previewApiData(action) || apiRequest(action, payload);
}

function renderUsers(items) {
  if (!items.length) return emptyState({ icon: '0', title: 'Sin usuarios', message: 'No hay usuarios autorizados para mostrar.' });
  return `<div class="desktop-only table-wrap"><table class="data-table compact-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sede</th><th>Estado</th><th>Último acceso</th></tr></thead><tbody>${items.map(item => `<tr><td class="primary-cell">${escapeHtml(item.name || '—')}</td><td>${escapeHtml(item.email || '—')}</td><td>${escapeHtml(humanizeCode(item.role))}</td><td>${escapeHtml(item.mainBranch || '—')}</td><td>${statusBadge(item.status)}</td><td>${escapeHtml(dateTime(item.lastAccess))}</td></tr>`).join('')}</tbody></table></div><div class="mobile-only order-card-list">${items.map(item => `<article class="order-card"><span class="order-card-top"><strong>${escapeHtml(item.name || '—')}</strong>${statusBadge(item.status)}</span><span class="order-card-client">${escapeHtml(item.email || '')}</span><span class="order-card-meta"><span>${escapeHtml(humanizeCode(item.role))}</span><strong>${escapeHtml(item.mainBranch || '—')}</strong></span></article>`).join('')}</div>`;
}

function bindInvitationForm(session) {
  const form = document.getElementById('invitation-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('invitation-submit');
    const output = document.getElementById('invitation-output');
    setBusy(button, true, 'Creando…');
    output.hidden = true;
    try {
      if (APP_CONFIG.preview.enabled) throw new Error('La vista local no crea invitaciones.');
      const branches = Array.from(document.querySelectorAll('input[name="invitation-branch"]:checked')).map(input => input.value);
      const response = await apiRequest('INVITACION_CREAR', {
        name: document.getElementById('invitation-name').value.trim(),
        email: document.getElementById('invitation-email').value.trim(),
        role: document.getElementById('invitation-role').value,
        mainBranch: document.getElementById('invitation-main-branch').value,
        branches
      });
      const link = String(response.data?.activationUrl || '');
      document.getElementById('invitation-link').value = link;
      output.hidden = false;
      form.reset();
      toast('Invitación creada. El enlace se muestra una sola vez.', 'success');
    } catch (error) {
      toast(error.message || 'No fue posible crear la invitación.', 'danger');
    } finally {
      setBusy(button, false);
    }
  });

  document.getElementById('copy-invitation-button')?.addEventListener('click', async () => {
    const input = document.getElementById('invitation-link');
    try {
      await navigator.clipboard.writeText(input.value);
      toast('Enlace copiado.', 'success');
    } catch {
      input.select();
      toast('Seleccionamos el enlace para que puedas copiarlo.', 'info');
    }
  });
}

guardPage({
  permission: 'config.read',
  activeKey: 'configuracion',
  title: 'Configuración',
  subtitle: 'Estado del sistema, usuarios e invitaciones.',
  async render({ session, content }) {
    const canManageUsers = hasPermission(session, 'users.manage');
    content.innerHTML = `<section class="page"><div class="page-header"><div class="page-heading"><h1>Configuración</h1><p>Esta pantalla consulta la base oficial y no expone secretos del sistema.</p></div><div class="page-actions"><span class="status-badge warning">Preparación</span></div></div><div id="system-state">${loadingState('Comprobando el sistema')}</div></section>`;
    const root = document.getElementById('system-state');
    try {
      const [systemResponse, usersResponse] = await Promise.all([request('SISTEMA_ESTADO'), request('USUARIOS_LISTAR')]);
      const system = systemResponse.data || {};
      const users = Array.isArray(usersResponse.data?.items) ? usersResponse.data.items : [];
      root.innerHTML = `<div class="system-grid"><article class="card system-card"><span class="status-badge success">Conectado</span><h2>Base de datos</h2><p>${escapeHtml(system.spreadsheetName || 'Base de Datos Maderarte App')}</p><small>${Number(system.counts?.orders || 0)} órdenes · ${Number(system.counts?.clients || 0)} clientes</small></article><article class="card system-card"><span class="status-badge info">v${escapeHtml(system.appVersion || APP_CONFIG.version)}</span><h2>Modo operativo</h2><p>${escapeHtml(system.mode || 'PREPARACION')}</p><small>Escrituras comerciales: ${escapeHtml(system.commercialWrites || 'DESHABILITADAS')}</small></article><article class="card system-card"><span class="status-badge warning">Aislado</span><h2>WhatsApp</h2><p>Mismo VPS, sesión y Bridge propios de Maderarte.</p><small>No configurado en esta etapa.</small></article></div>
        <section class="card panel section-gap"><div class="panel-header"><h2>Usuarios autorizados</h2><span class="status-badge info">${users.length}</span></div>${renderUsers(users)}</section>
        ${canManageUsers ? `<section class="card panel section-gap"><div class="panel-header"><h2>Invitar usuario</h2></div><form class="form-grid" id="invitation-form"><div class="field"><label for="invitation-name">Nombre completo</label><input id="invitation-name" required maxlength="160"></div><div class="field"><label for="invitation-email">Correo</label><input id="invitation-email" type="email" required autocomplete="off"></div><div class="field"><label for="invitation-role">Rol</label><select id="invitation-role" required><option value="VENDEDOR">Vendedor</option><option value="BODEGA_LOGISTICA">Bodega y logística</option><option value="CONSULTA">Consulta</option><option value="ADMINISTRADOR">Administrador</option></select></div><div class="field"><label for="invitation-main-branch">Sede principal</label><select id="invitation-main-branch" required><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div><fieldset class="field checkbox-field"><legend>Sedes permitidas</legend><label class="checkbox-row"><input type="checkbox" name="invitation-branch" value="MP" checked> Principal</label><label class="checkbox-row"><input type="checkbox" name="invitation-branch" value="TP"> Terraplaza</label></fieldset><div class="form-actions"><button class="button primary" id="invitation-submit" type="submit">Crear invitación</button></div></form><div class="invitation-output" id="invitation-output" hidden><div class="field"><label for="invitation-link">Enlace de activación</label><input id="invitation-link" readonly></div><button class="button secondary" id="copy-invitation-button" type="button">Copiar enlace</button><small>Por seguridad, este enlace solo se entrega en esta respuesta.</small></div></section>` : ''}`;
      bindInvitationForm(session);
    } catch (error) {
      root.innerHTML = errorState(error.message, error.requestId);
    }
  }
});
