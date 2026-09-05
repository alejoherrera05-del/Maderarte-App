import { withPreview } from '../core/config.js';
import { logout, sendPasswordReset } from '../core/auth.js';
import { getDeviceMetadata, setDeviceName } from '../core/session.js';
import { escapeHtml, initials } from '../core/format.js';
import { guardStandalonePage } from '../core/page-guard.js';

function tile(label, value, id = '') {
  return `<article class="pf-tile"><span>${escapeHtml(label)}</span><strong${id ? ` id="${escapeHtml(id)}"` : ''}>${escapeHtml(String(value || '—'))}</strong></article>`;
}

function showFeedback(message, tone = '') {
  const node = document.getElementById('pf-feedback');
  node.textContent = message || '';
  node.className = `pf-feedback${tone ? ` ${tone}` : ''}`;
}

function render(root, session) {
  const device = getDeviceMetadata();
  root.innerHTML = `<header class="pf-header"><div class="pf-header-inner"><a class="pf-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Volver al inicio"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a><div class="pf-brand"><strong>Mi perfil</strong><span>Maderarte App</span></div><span></span></div></header>
  <main class="pf-shell"><section class="pf-hero"><div class="pf-hero-top"><div class="pf-avatar">${escapeHtml(initials(session.profile.name))}</div><div><h1>${escapeHtml(session.profile.name || 'Usuario Maderarte')}</h1><div class="pf-email">${escapeHtml(session.profile.email || '')}</div><div class="pf-role">${escapeHtml(session.profile.role || 'USUARIO')}</div></div></div></section>
  <section class="pf-grid">${tile('Estado', session.profile.status)}${tile('Sede principal', session.profile.mainBranch)}${tile('Dispositivo', device.name, 'pf-device-name')}${tile('Plataforma', `${device.platform} · ${device.browser}`)}</section>
  <section class="pf-actions"><button class="pf-action primary" id="pf-password" type="button">Cambiar contraseña</button><button class="pf-action" id="pf-rename" type="button">Renombrar dispositivo</button><button class="pf-action danger" id="pf-logout" type="button">Cerrar sesión</button></section>
  <div class="pf-feedback" id="pf-feedback" role="status"></div><div class="pf-note">Tu acceso es personal. Las acciones realizadas en Maderarte quedan asociadas a tu sesión y a este dispositivo.</div></main>
  <div class="pf-modal" id="pf-device-modal" aria-hidden="true"><section class="pf-modal-card" role="dialog" aria-modal="true" aria-labelledby="pf-modal-title"><h2 id="pf-modal-title">Nombre del dispositivo</h2><p>Usa un nombre que te ayude a reconocer este equipo.</p><input class="pf-input" id="pf-device-input" maxlength="80" value="${escapeHtml(device.name)}"><div class="pf-modal-actions"><button class="pf-cancel" id="pf-modal-cancel" type="button">Cancelar</button><button class="pf-save" id="pf-modal-save" type="button">Guardar</button></div></section></div>`;
}

guardStandalonePage({
  permission: 'perfil.read',
  async render({ session }) {
    const root = document.getElementById('profile-app');
    render(root, session);
    root.hidden = false;

    document.getElementById('pf-password').addEventListener('click', async () => {
      showFeedback('Enviando instrucciones…');
      try {
        await sendPasswordReset(session.profile.email);
        showFeedback('Te enviamos un enlace para cambiar tu contraseña.', 'success');
      } catch (error) {
        showFeedback(error.message || 'No fue posible enviar el correo.', 'danger');
      }
    });

    const modal = document.getElementById('pf-device-modal');
    const input = document.getElementById('pf-device-input');
    const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
    document.getElementById('pf-rename').addEventListener('click', () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); input.focus(); input.select(); });
    document.getElementById('pf-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    document.getElementById('pf-modal-save').addEventListener('click', () => {
      const value = setDeviceName(input.value);
      document.getElementById('pf-device-name').textContent = value || getDeviceMetadata().name;
      closeModal();
      showFeedback('Nombre del dispositivo actualizado.', 'success');
    });

    document.getElementById('pf-logout').addEventListener('click', async () => {
      await logout();
      window.location.replace(withPreview('/login.html'));
    });
  }
});
