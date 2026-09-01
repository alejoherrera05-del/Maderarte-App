import { APP_CONFIG } from '../core/config.js';
import { readSessionSnapshot } from '../core/session.js';
import { homeUrl, sendPasswordReset, signIn } from '../core/auth.js';
import { initializeTheme, redirectAfterLogin } from '../core/shell.js';
import { setBusy } from '../core/ui.js';

initializeTheme();

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberInput = document.getElementById('remember');
const submitButton = document.getElementById('login-button');
const resetButton = document.getElementById('reset-password-button');
const message = document.getElementById('form-message');
const previewNotice = document.getElementById('preview-notice');

if (APP_CONFIG.preview.enabled) previewNotice.hidden = false;

const next = new URL(window.location.href).searchParams.get('next') || homeUrl();
if (readSessionSnapshot() && !APP_CONFIG.preview.enabled) redirectAfterLogin(next);

function showMessage(value, success = false) {
  message.textContent = value || '';
  message.classList.toggle('success', success);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  showMessage('');
  setBusy(submitButton, true, 'Validando…');
  try {
    await signIn(emailInput.value, passwordInput.value, rememberInput.checked);
    redirectAfterLogin(next);
  } catch (error) {
    showMessage(error.message || 'No fue posible iniciar sesión.');
  } finally {
    setBusy(submitButton, false);
  }
});

resetButton.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    showMessage('Escribe primero el correo de la cuenta.');
    emailInput.focus();
    return;
  }
  setBusy(resetButton, true, 'Enviando…');
  try {
    await sendPasswordReset(email);
    showMessage(APP_CONFIG.preview.enabled
      ? 'La vista local no envía correos.'
      : 'Firebase envió las instrucciones para restablecer la contraseña.', true);
  } catch (error) {
    showMessage(error.message || 'No fue posible enviar el correo.');
  } finally {
    setBusy(resetButton, false);
  }
});
