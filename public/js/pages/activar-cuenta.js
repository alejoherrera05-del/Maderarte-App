import { APP_CONFIG } from '../core/config.js';
import { activateInvitation, createFirebaseAccount, signInFirebaseOnly, validateInvitation } from '../core/auth.js';
import { initializeTheme, redirectAfterLogin } from '../core/shell.js';
import { escapeHtml } from '../core/format.js';
import { setBusy } from '../core/ui.js';

initializeTheme();

const token = new URL(window.location.href).searchParams.get('token') || '';
const state = document.getElementById('activation-state');
const form = document.getElementById('activation-form');
const emailInput = document.getElementById('activation-email');
const nameElement = document.getElementById('activation-name');
const roleElement = document.getElementById('activation-role');
const passwordInput = document.getElementById('activation-password');
const confirmInput = document.getElementById('activation-confirm');
const rememberInput = document.getElementById('activation-remember');
const button = document.getElementById('activation-button');
const message = document.getElementById('activation-message');

function showMessage(value, success = false) {
  message.textContent = value || '';
  message.classList.toggle('success', success);
}

async function loadInvitation() {
  if (!token || APP_CONFIG.preview.enabled) {
    state.innerHTML = '<h1>Invitación no disponible</h1><p>Este enlace necesita un token válido emitido por Maderarte App.</p>';
    return;
  }
  try {
    const invitation = await validateInvitation(token);
    emailInput.value = invitation.email || '';
    nameElement.textContent = invitation.name || 'Usuario Maderarte';
    roleElement.textContent = invitation.role || 'USUARIO';
    state.hidden = true;
    form.hidden = false;
  } catch (error) {
    state.innerHTML = `<h1>No pudimos validar la invitación</h1><p>${escapeHtml(error.message || 'El enlace no es válido o ya venció.')}</p>`;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  showMessage('');
  const password = passwordInput.value;
  if (password.length < 6) {
    showMessage('La contraseña debe tener al menos seis caracteres.');
    return;
  }
  if (password !== confirmInput.value) {
    showMessage('Las contraseñas no coinciden.');
    return;
  }

  setBusy(button, true, 'Activando…');
  try {
    let firebase;
    try {
      firebase = await createFirebaseAccount(emailInput.value, password);
    } catch (error) {
      if (error.code !== 'EMAIL_EXISTS') throw error;
      firebase = await signInFirebaseOnly(emailInput.value, password);
    }
    await activateInvitation(token, firebase.idToken, rememberInput.checked ? 'local' : 'session');
    showMessage('Cuenta activada correctamente.', true);
    window.setTimeout(() => redirectAfterLogin('/index.html'), 500);
  } catch (error) {
    showMessage(error.message || 'No fue posible activar la cuenta.');
  } finally {
    setBusy(button, false);
  }
});

loadInvitation();
