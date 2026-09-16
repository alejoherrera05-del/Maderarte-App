import { RELEASE_ID } from './release.js';
import { hasActiveRequests } from './request-activity.js';

const RELEASE_PATTERN = /^[a-f0-9]{24}$/;
const EDITABLE = 'input:not([type="hidden"]):not([type="search"]),textarea,select,[contenteditable="true"]';

// Only informs. The currently open document remains in control of its lifecycle.
export function watchRelease({ current, onAvailable, target = window, doc = document,
  fetchRelease = (...args) => fetch(...args), now = Date.now, intervalMs = 300_000 }) {
  let stopped = false, pending = false, last = -Infinity, controller;
  async function check() {
    if (stopped || pending || doc.visibilityState === 'hidden' || now() - last < intervalMs) return;
    pending = true; last = now();
    controller = new AbortController();
    const timeout = target.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetchRelease('/release.json', {
        cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const release = await response.json();
      if (!stopped && release.schema === 1 && RELEASE_PATTERN.test(release.id) && release.id !== current) {
        stop(); onAvailable(release.id);
      }
    } catch { /* Offline and old deployments must not interrupt work. */ }
    finally { target.clearTimeout(timeout); pending = false; }
  }
  const resume = () => void check();
  const timer = target.setInterval(resume, intervalMs);
  target.addEventListener('focus', resume);
  target.addEventListener('pageshow', resume);
  target.addEventListener('online', resume);
  doc.addEventListener('visibilitychange', resume);
  function stop() {
    stopped = true; controller?.abort(); target.clearInterval(timer);
    target.removeEventListener('focus', resume);
    target.removeEventListener('pageshow', resume);
    target.removeEventListener('online', resume);
    doc.removeEventListener('visibilitychange', resume);
  }
  void check();
  return stop;
}

function exposed(element) {
  return !element.closest('[hidden],[aria-hidden="true"],dialog:not([open])') &&
    element.ownerDocument.defaultView.getComputedStyle(element).display !== 'none';
}

export function trackUpdateSafety({ doc = document, busy = hasActiveRequests } = {}) {
  let edited = false;
  const changed = event => {
    if (event.target.matches?.(EDITABLE) && !event.target.closest('[role="search"],#maddy-update')) edited = true;
  };
  doc.addEventListener('input', changed, true);
  doc.addEventListener('change', changed, true);
  return {
    reason() {
      if (busy()) return 'Hay una operación en curso. Espera a que termine.';
      // A restored/pre-filled commercial form also needs protection before the first keystroke.
      if (edited || /\/(pedido|cotizacion)\.html$/.test(doc.location.pathname) ||
          [...doc.querySelectorAll('form:not([role="search"]),dialog[open],[aria-modal="true"]')].some(exposed)) {
        return 'Termina y guarda el formulario. Actualiza al volver al inicio.';
      }
      return '';
    },
    stop() {
      doc.removeEventListener('input', changed, true);
      doc.removeEventListener('change', changed, true);
    }
  };
}

export function showUpdateNotice({ doc = document, safety, reload = () => window.location.reload() }) {
  if (doc.getElementById('maddy-update')) return;
  const notice = doc.createElement('aside');
  notice.id = 'maddy-update'; notice.className = 'app-update';
  notice.setAttribute('aria-labelledby', 'maddy-update-title');
  notice.innerHTML = `<div class="app-update-copy" role="status" aria-live="polite" aria-atomic="true">
    <strong id="maddy-update-title">Maddy tiene una actualización</strong>
    <p id="maddy-update-message">Puedes seguir trabajando y actualizar después.</p>
  </div><div class="app-update-actions">
    <button type="button" data-update-later>Después</button>
    <button type="button" data-update-now>Actualizar <span aria-hidden="true">↻</span></button>
  </div>`;
  // Append without focusing: typing, cursor position and open sheets are untouched.
  doc.body.append(notice);
  notice.querySelector('[data-update-later]').onclick = () => { notice.remove(); safety.stop(); };
  notice.querySelector('[data-update-now]').onclick = () => {
    const reason = safety.reason();
    if (reason) {
      notice.querySelector('#maddy-update-message').textContent = reason;
      return;
    }
    reload();
  };
  return notice;
}

let started = false;
export function startAppUpdates() {
  if (started || window.location.hostname !== 'app.maderartepopayan.com') return;
  started = true;
  const safety = trackUpdateSafety();
  watchRelease({ current: RELEASE_ID, onAvailable: () => showUpdateNotice({ safety }) });
}
