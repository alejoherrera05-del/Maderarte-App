import { clearOrderSaveSnapshots } from './order-save.js?v=save-1';

const PREFIX = 'maderarte.form-draft.v1.';

export function clearFormDrafts(storage = window.sessionStorage) {
  clearOrderSaveSnapshots(storage);
  for (const key of Object.keys(storage)) if (key.startsWith(PREFIX)) storage.removeItem(key);
  if (storage === window.sessionStorage) {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
    window.dispatchEvent(new window.Event('maddy:drafts-cleared'));
  }
}

// Device recovery, isolated by account and document type. Never a commercial record.
export function bindFormDraft({ session, type, capture, restore, root = document, storage = window.localStorage, legacyStorage = window.sessionStorage }) {
  const uid = session?.profile?.uid;
  if (!uid) return null;
  const key = `${PREFIX}${uid}.${type}`;
  const status = root.getElementById('quote-draft-status');
  let recovering = true;
  let dirty = false;
  let safe = true;
  let locked = false;
  let completed = false;
  let blocked = false;
  let expected = null;
  const tell = message => {
    if (!status) return;
    const copy = root.createElement('span');
    copy.textContent = message;
    const discard = root.createElement('button');
    discard.type = 'button';
    discard.textContent = 'Descartar borrador';
    discard.addEventListener('click', () => {
      if (locked || completed) return;
      if (!window.confirm('¿Descartar este borrador y empezar uno nuevo? Se borrarán los datos escritos en este formulario.')) return;
      try {
        if (storage.getItem(key) !== expected) throw new Error('Otra pestaña cambió el borrador');
        storage.removeItem(key);
        legacyStorage.removeItem(key);
      } catch { tell('No se pudo descartar el borrador. La copia sigue guardada.'); return; }
      completed = true;
      dirty = false;
      window.location.reload();
    });
    status.replaceChildren(copy, discard);
  };
  function save() {
    if (recovering || !dirty || locked || completed || blocked) return;
    try {
      if (storage.getItem(key) !== expected) {
        blocked = true; safe = false;
        tell('El borrador cambió en otra pestaña. Estos cambios no se han guardado; mantén esta pestaña abierta para revisarlos.');
        return;
      }
      const data = capture();
      const savedAt = Date.now();
      const raw = JSON.stringify({ version: 1, uid, type, savedAt, data });
      storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw new Error('Guardado no confirmado');
      expected = raw;
      safe = true;
      try { if (legacyStorage !== storage) legacyStorage.removeItem(key); } catch { /* Durable copy confirmed. */ }
      tell(`Guardado en este dispositivo · ${new Date(savedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      safe = false;
      // setItem is atomic: preserve the last confirmed copy on quota failures.
      tell('No pudimos conservar los últimos cambios. Mantén esta pestaña abierta. La última copia guardada no se ha borrado.');
    }
  }
  const ready = (async () => {
    try {
      expected = storage.getItem(key);
      const parse = raw => {
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (entry?.version !== 1 || entry.uid !== uid || entry.type !== type || !entry.data || !Number.isFinite(entry.savedAt)) throw new Error('Borrador incompatible');
        return entry;
      };
      const durable = parse(expected);
      const legacy = parse(legacyStorage === storage ? null : legacyStorage.getItem(key));
      const draft = legacy && (!durable || legacy.savedAt > durable.savedAt) ? legacy : durable;
      if (draft) {
        await restore(draft.data);
        dirty = true;
        tell('Recuperamos tu borrador de este dispositivo. Revísalo antes de continuar.');
      }
    } catch {
      blocked = true; safe = false;
      tell('No pudimos recuperar el borrador completo. La copia sigue guardada y no será sobrescrita. Mantén esta pestaña abierta para revisarlo.');
    } finally { recovering = false; if (dirty && !blocked) save(); }
  })();
  function changed() { if (!locked && !completed) { dirty = true; save(); } }
  root.getElementById('quote-form')?.addEventListener('input', changed);
  root.getElementById('quote-form')?.addEventListener('change', changed);
  window.addEventListener('pagehide', save);
  root.addEventListener('visibilitychange', () => { if (root.visibilityState === 'hidden') save(); });
  window.addEventListener('maddy:drafts-cleared', () => { completed = true; locked = true; });
  window.addEventListener('beforeunload', event => {
    save();
    if (dirty && !safe) { event.preventDefault(); event.returnValue = ''; }
  });
  const api = { ready, changed, save,
    setLocked(value) { locked = Boolean(value); },
    complete() {
      // Prevent pagehide from resurrecting an already confirmed order as a draft.
      completed = true; locked = true; dirty = false;
      try {
        if (storage.getItem(key) === expected) storage.removeItem(key);
        legacyStorage.removeItem(key);
      } catch { /* The save journal still prevents another submission. */ }
      status?.replaceChildren();
    }
  };
  window.addEventListener('maddy:quote-confirmed', () => { if (type === 'quote' || type.startsWith('quote:')) api.complete(); });
  return api;
}
