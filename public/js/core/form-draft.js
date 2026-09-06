const PREFIX = 'maderarte.form-draft.v1.';
const MAX_AGE = 8 * 60 * 60 * 1000;

export function clearFormDrafts(storage = window.sessionStorage) {
  for (const key of Object.keys(storage)) if (key.startsWith(PREFIX)) storage.removeItem(key);
}

// A tab-scoped recovery copy, isolated by account and document type. Never an OP.
export function bindFormDraft({ session, type, capture, restore, root = document, storage = window.sessionStorage }) {
  const uid = session?.profile?.uid;
  if (!uid) return null;
  const key = `${PREFIX}${uid}.${type}`;
  const status = root.getElementById('quote-draft-status');
  let recovering = true;
  let dirty = false;
  let safe = true;
  const tell = message => {
    if (!status) return;
    const copy = root.createElement('span');
    copy.textContent = message;
    const discard = root.createElement('button');
    discard.type = 'button';
    discard.textContent = 'Descartar borrador';
    discard.addEventListener('click', () => {
      if (!window.confirm('¿Descartar este borrador y empezar uno nuevo? Se borrarán los datos escritos en este formulario.')) return;
      try { storage.removeItem(key); } catch { /* A failed draft remains only in memory. */ }
      dirty = false;
      window.location.reload();
    });
    status.replaceChildren(copy, discard);
  };
  function save() {
    if (recovering || !dirty) return;
    try {
      const data = capture();
      storage.setItem(key, JSON.stringify({ version: 1, uid, type, savedAt: Date.now(), data }));
      safe = true;
      tell('Borrador temporal en esta pestaña. Aún no es un pedido ni un pago registrado.');
    } catch {
      safe = false;
      // An old copy must not masquerade as the current one after a quota failure.
      try { storage.removeItem(key); } catch { /* Storage itself may be blocked. */ }
      tell('No pudimos conservar el borrador temporal. Mantén esta pestaña abierta para no perder lo escrito.');
    }
  }
  const ready = (async () => {
    try {
      for (const storedKey of Object.keys(storage)) {
        if (!storedKey.startsWith(PREFIX)) continue;
        let entry;
        try { entry = JSON.parse(storage.getItem(storedKey)); } catch { /* Discard malformed recovery data. */ }
        if (!entry || entry.uid !== uid || entry.version !== 1 || Date.now() - entry.savedAt > MAX_AGE || entry.savedAt > Date.now()) storage.removeItem(storedKey);
      }
      const draft = JSON.parse(storage.getItem(key) || 'null');
      if (draft?.type === type) {
        await restore(draft.data);
        dirty = true;
        tell('Recuperamos tu borrador de esta pestaña. Revísalo antes de continuar.');
      }
    } catch {
      try { storage.removeItem(key); } catch { /* Storage unavailable. */ }
      tell('No fue posible recuperar el borrador anterior. Revisa los datos del formulario.');
    } finally { recovering = false; }
  })();
  function changed() { if (!recovering) { dirty = true; save(); } }
  root.getElementById('quote-form')?.addEventListener('input', changed);
  root.getElementById('quote-form')?.addEventListener('change', changed);
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', event => {
    save();
    if (dirty && !safe) { event.preventDefault(); event.returnValue = ''; }
  });
  return { ready, changed, save };
}
