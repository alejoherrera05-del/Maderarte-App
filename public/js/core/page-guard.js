import { APP_CONFIG } from './config.js';
import { loginRedirect, validateSession } from './auth.js';
import { canAccessPage } from './permissions.js';
import { initializeTheme, mountShell } from './shell.js';
import { errorState } from './ui.js';

function shouldRedirectToLogin(error) {
  const code = String(error?.code || '');
  return !error?.transient || ['NO_SESSION', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'USER_NOT_AUTHORIZED', 'USER_INACTIVE'].includes(code);
}

export async function guardPage({ permission, activeKey, title, subtitle, render }) {
  initializeTheme();
  try {
    const session = await validateSession();
    if (!canAccessPage(session, permission)) {
      const content = mountShell({ session, activeKey, title: 'Acceso restringido', subtitle: 'Tu cuenta no tiene permiso para esta sección.' });
      content.innerHTML = `<section class="page">${errorState('No tienes autorización para abrir esta pantalla.')}</section>`;
      return;
    }
    const content = mountShell({ session, activeKey, title, subtitle });
    await render({ session, content });
  } catch (error) {
    if (shouldRedirectToLogin(error)) {
      window.location.replace(loginRedirect());
      return;
    }
    document.body.innerHTML = `<main class="page">${errorState(error.message || 'No fue posible validar la sesión.', error.requestId)}</main>`;
  }
}

/**
 * Protege una pantalla con experiencia completa propia sin forzarla dentro del
 * shell genérico. Conserva las mismas reglas de sesión y permisos de Maderarte.
 */
export async function guardStandalonePage({ permission, render }) {
  initializeTheme();
  try {
    const session = await validateSession();
    if (!canAccessPage(session, permission)) {
      document.body.innerHTML = `<main class="standalone-access-state">${errorState('No tienes autorización para abrir esta pantalla.')}</main>`;
      return;
    }
    await render({ session });
  } catch (error) {
    if (shouldRedirectToLogin(error)) {
      window.location.replace(loginRedirect());
      return;
    }
    document.body.innerHTML = `<main class="standalone-access-state">${errorState(error.message || 'No fue posible validar la sesión.', error.requestId)}</main>`;
  }
}
