import { currentSandboxId, sandboxLink } from '../core/order-sandbox-context.js';
import { prepareOrderMedia } from '../core/order-media.js?v=documents-1';
import { APP_CONFIG } from '../core/config.js';
import { apiRequest } from '../core/api.js?v=sandbox-1';
import { hasPermission } from '../core/permissions.js';
import { readSessionSnapshot } from '../core/session.js';
import { createOrderSave } from '../core/order-save.js?v=sandbox-1';
import { collectOrderPayload } from '../core/order-payload.js?v=documents-1';

// No independent form or accounting UI. Reuse the approved button and helper.
export function bindOrderSave({ session, validate, branch, photos, draft, mediaBusy = () => false,
  request = apiRequest, navigate = path => window.location.assign(path) }) {
  if (APP_CONFIG.preview.enabled || !hasPermission(session, 'ordenes.create')) return null;
  const form = document.getElementById('quote-form');
  const button = document.getElementById('quote-submit');
  const note = document.querySelector('.quote-write-note');
  if (!form || !button || !note) return null;
  const defaultNote = note.textContent;
  const heading = document.querySelector('.quote-summary-head > span');
  const defaultHeading = heading?.textContent || '';
  const error = document.getElementById('quote-form-error');
  const status = document.createElement('div');
  status.className = 'quote-draft-status';
  status.id = 'order-save-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  note.insertAdjacentElement('afterend', status);
  const disabled = new Map();
  let locked = false;
  let lastPhase = '';
  let confirmedRequest = '';
  let manager;
  const disable = (node, value) => {
    if (value) { if (!disabled.has(node)) disabled.set(node, node.disabled); node.disabled = true; }
    else if (disabled.has(node)) { node.disabled = disabled.get(node); disabled.delete(node); }
  };
  function freeze(value) {
    locked = value;
    document.querySelectorAll('#quote-form input, #quote-form select, #quote-form textarea, #quote-form button, #quote-change-branch, [data-quote-branch], #quote-draft-status button')
      .forEach(node => { if (node !== button && !status.contains(node)) disable(node, value); });
    disable(document.getElementById('quote-preview-button'), value);
    draft()?.setLocked(value);
  }
  function action(text, handler) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'quote-secondary-action';
    node.textContent = text;
    node.addEventListener('click', () => { void handler(); });
    status.append(node);
  }
  const orderPath = number => sandboxLink(`/orden.html?op=${encodeURIComponent(number)}`);
  function render(state) {
    freeze(state.locked);
    const gate = document.getElementById('quote-branch-gate');
    // A closed/expired tab draft must not hide recovery behind the branch gate,
    // or present empty/unrelated draft values as the confirmed order's figures.
    const recoveryOnly = state.locked && (!branch() || state.phase === 'other-tab'
      || (['confirmed', 'documents'].includes(state.phase) && !state.ownsDraft));
    gate.hidden = recoveryOnly;
    document.querySelectorAll('.quote-editor, .quote-document-head, .quote-summary-row, .quote-summary-total, #quote-summary-preview, #quote-item-count, #quote-draft-status, #quote-form-error')
      .forEach(node => { node.hidden = recoveryOnly; });
    if (heading) heading.textContent = recoveryOnly ? 'Recuperación del pedido' : defaultHeading;
    if (state.locked) {
      document.getElementById('quote-workspace').hidden = false;
      gate.classList.add('is-closed');
    } else if (!branch()) {
      document.getElementById('quote-workspace').hidden = true;
      gate.classList.remove('is-closed');
    }
    button.disabled = !state.canSave;
    button.textContent = state.phase === 'saving' ? 'Guardando pedido…' : state.phase === 'documents' ? 'Documentos pendientes' : state.phase === 'confirmed' ? 'Pedido guardado' : 'Guardar orden de pedido';
    button.setAttribute('aria-busy', String(['saving', 'checking'].includes(state.phase)));
    note.textContent = state.phase === 'disabled' || state.phase === 'ready' ? defaultNote : state.message;
    status.replaceChildren();
    status.hidden = !['uncertain', 'retry', 'confirmed', 'documents', 'other-tab', 'blocked', 'rejected'].includes(state.phase);
    if (!status.hidden) {
      if (state.phase === 'confirmed') {
        action('Abrir pedido', () => navigate(orderPath(state.number)));
        if (!currentSandboxId()) action('Nuevo pedido', async () => {
          const result = await manager.startNew(() => draft()?.complete());
          if (result.phase === 'new') window.location.reload();
        });
        if (state.ownsDraft && confirmedRequest !== state.requestId) { confirmedRequest = state.requestId; draft()?.complete(); }
      } else if (state.phase === 'documents') {
        action('Completar documentos', () => manager.refresh());
        action('Abrir pedido registrado', () => navigate(orderPath(state.number)));
      } else {
        action(state.locked ? 'Consultar resultado' : 'Comprobar disponibilidad', () => manager.refresh());
        if (state.phase === 'retry') action('Reenviar el mismo intento', () => manager.retry());
      }
    }
    if (state.phase !== lastPhase && status.firstElementChild && state.phase !== 'confirmed') status.firstElementChild.focus({ preventScroll: true });
    lastPhase = state.phase;
  }
  try {
    manager = createOrderSave({ uid: session.profile.uid, scope: currentSandboxId(), request, durable: window.localStorage,
      temporary: window.sessionStorage, locks: window.navigator.locks, crypto: window.crypto,
      activeUid: () => readSessionSnapshot()?.profile.uid || '', onState: render });
  } catch {
    button.disabled = true;
    note.textContent = 'No se pudo comprobar la recuperación. Puedes conservar y revisar el borrador, sin guardarlo todavía.';
    return null;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (locked || !manager.getState().canSave) return;
    if (!validate()) return;
    if (mediaBusy() || [...document.querySelectorAll('[data-photo-input]')].some(input => input.files?.length)) {
      error.textContent = 'Termina de cargar las fotografías antes de guardar. No se descartará ninguna referencia.';
      return;
    }
    let payload;
    const selectedPhotos = new Map([...photos()].map(([id, values]) => [id, values.map(value => ({ ...value }))]));
    try {
      payload = collectOrderPayload({ branch: branch(), photos: selectedPhotos, mediaEnabled: manager.getState().mediaEnabled === true });
      freeze(true);
      payload = await prepareOrderMedia(payload, selectedPhotos);
    } catch (failure) {
      freeze(false); error.textContent = failure.message; return;
    }
    draft()?.save();
    error.textContent = '';
    render({ phase: 'saving', locked: true, canSave: false, message: 'Preparando el guardado del pedido…' });
    const result = await manager.save(payload);
    if (result.phase === 'confirmed') navigate(orderPath(result.number));
  });
  // Storage events never resend. Other tabs explicitly reconcile the journal.
  window.addEventListener('storage', event => {
    if (event.key === manager.key) {
      freeze(true);
      button.disabled = true;
      void manager.refresh();
    }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) void manager.refresh(); });
  window.addEventListener('beforeunload', event => {
    if (locked && manager.getState().phase !== 'confirmed') {
      event.preventDefault(); event.returnValue = '';
    }
  });
  void manager.refresh();
  return manager;
}
