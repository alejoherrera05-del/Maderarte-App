import { APP_CONFIG } from './config.js';
import { loginRedirect, validateSession } from './auth.js';
import { canAccessPage } from './permissions.js';
import { initializeTheme, mountShell } from './shell.js';
import { errorState } from './ui.js';

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
    const code = String(error?.code || '');
    if (!error?.transient || ['NO_SESSION', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'USER_NOT_AUTHORIZED', 'USER_INACTIVE'].includes(code)) {
      window.location.replace(loginRedirect());
      return;
    }
    document.body.innerHTML = `<main class="page">${errorState(error.message || 'No fue posible validar la sesión.', error.requestId)}</main>`;
  }
}
