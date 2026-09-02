import { loginRedirect, revalidateSession, validateSession } from './auth.js';
import { canAccessPage } from './permissions.js';
import { readSessionSnapshot } from './session.js';
import { initializeTheme, mountShell } from './shell.js';
import { errorState } from './ui.js';

let pendingTimer = null;

function shouldRedirectToLogin(error) {
  const code = String(error?.code || '');
  return !error?.transient || ['NO_SESSION', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'USER_NOT_AUTHORIZED', 'USER_INACTIVE'].includes(code);
}

function showPendingCover() {
  if (document.getElementById('maderarte-session-pending')) return;
  const cover = document.createElement('div');
  cover.id = 'maderarte-session-pending';
  cover.className = 'session-pending-cover';
  cover.setAttribute('role', 'status');
  cover.setAttribute('aria-live', 'polite');
  cover.innerHTML = `<div class="session-pending-content">
    <img src="/assets/brand/maderarte-logo-2026.webp" alt="" aria-hidden="true">
    <span>Abriendo Maderarte…</span>
  </div>`;
  document.body.appendChild(cover);
}

function schedulePendingCover() {
  window.clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(showPendingCover, 220);
}

function hidePendingCover() {
  window.clearTimeout(pendingTimer);
  pendingTimer = null;
  document.getElementById('maderarte-session-pending')?.remove();
}

async function initialSession() {
  const cached = readSessionSnapshot();
  if (cached) return validateSession({ preferCache: true });
  schedulePendingCover();
  return validateSession({ allowCachedOnTransient: true });
}

function renderStandaloneState(message, requestId = '') {
  document.body.innerHTML = `<main class="standalone-access-state">${errorState(message, requestId)}</main>`;
}

function revalidateInBackground(session, permission) {
  if (!session?.needsRevalidation) return;
  void revalidateSession({ allowCachedOnTransient: true }).then(fresh => {
    if (fresh?.offline) return;
    if (!canAccessPage(fresh, permission)) window.location.reload();
  }).catch(error => {
    if (shouldRedirectToLogin(error)) window.location.replace(loginRedirect());
  });
}

export async function guardPage({ permission, activeKey, title, subtitle, render }) {
  initializeTheme();
  try {
    const session = await initialSession();
    hidePendingCover();
    if (!canAccessPage(session, permission)) {
      const content = mountShell({ session, activeKey, title: 'Acceso restringido', subtitle: 'Tu cuenta no tiene permiso para esta sección.' });
      content.innerHTML = `<section class="page">${errorState('No tienes autorización para abrir esta pantalla.')}</section>`;
      revalidateInBackground(session, permission);
      return;
    }
    const content = mountShell({ session, activeKey, title, subtitle });
    await render({ session, content });
    revalidateInBackground(session, permission);
  } catch (error) {
    hidePendingCover();
    if (shouldRedirectToLogin(error)) {
      window.location.replace(loginRedirect());
      return;
    }
    renderStandaloneState(error.message || 'No fue posible validar la sesión.', error.requestId);
  }
}

export async function guardStandalonePage({ permission, render }) {
  initializeTheme();
  try {
    const session = await initialSession();
    hidePendingCover();
    if (!canAccessPage(session, permission)) {
      renderStandaloneState('No tienes autorización para abrir esta pantalla.');
      revalidateInBackground(session, permission);
      return;
    }
    await render({ session });
    revalidateInBackground(session, permission);
  } catch (error) {
    hidePendingCover();
    if (shouldRedirectToLogin(error)) {
      window.location.replace(loginRedirect());
      return;
    }
    renderStandaloneState(error.message || 'No fue posible validar la sesión.', error.requestId);
  }
}
