// One pending operation per account/browser. Only an opaque journal survives tab
// closure; the immutable commercial payload stays in this tab's sessionStorage.
// Neither a timeout nor an empty status response authorizes a new request ID.
export const ORDER_SAVE_PREFIX = 'maderarte.order-save.v1.';
const ID = /^[A-Za-z0-9_-]{16,120}$/;
const NUMBER = /^(?:MP|TP)-[A-Z0-9-]+-[0-9]+$/;
const fail = (code, message) => Object.assign(new Error(message), { code });
const copy = value => JSON.parse(JSON.stringify(value));

export function saveCapabilitiesReady(value) {
  return value?.contractVersion === 1 && value.enabled === true
    && value.photosReady === true && value.documentsReady === true;
}

export function clearOrderSaveSnapshots(storage) {
  // Logout removes commercial contents, NEVER the opaque unresolved journal.
  for (const key of Object.keys(storage)) if (key.startsWith(ORDER_SAVE_PREFIX)) storage.removeItem(key);
}

export function createOrderSave({ uid, request, durable, temporary, locks, crypto,
  activeUid = () => uid, onState = () => {} }) {
  if (!uid) throw fail('NO_SESSION', 'Inicia sesión nuevamente.');
  const key = `${ORDER_SAVE_PREFIX}${encodeURIComponent(uid)}`;
  let busy = false;
  let state = { phase: 'disabled', canSave: false, locked: false, message: '' };
  const notify = (phase, options = {}) => {
    state = { phase, canSave: false, locked: true, message: '', ...options };
    onState(copy(state));
    return copy(state);
  };
  const sameUser = () => {
    if (activeUid() !== uid) throw fail('NO_SESSION', 'Inicia sesión con la cuenta que comenzó este pedido.');
  };
  const getJournal = () => {
    const raw = durable.getItem(key);
    if (!raw) return null;
    let value;
    try { value = JSON.parse(raw); } catch { /* fail closed; do not delete */ }
    if (!value || value.version !== 1 || value.uid !== uid || !ID.test(value.requestId)
      || !/^[a-f0-9]{64}$/.test(value.digest) || !['pending', 'confirmed'].includes(value.stage)
      || (value.stage === 'confirmed' && !NUMBER.test(value.number))) {
      throw fail('LOCAL_RECOVERY_REQUIRED', 'El registro de guardado necesita revisión. No borres los datos del navegador.');
    }
    return value;
  };
  const put = (storage, value) => {
    const serialized = JSON.stringify(value);
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw fail('STORAGE_UNAVAILABLE', 'No se pudo asegurar la recuperación del pedido.');
  };
  const digest = async payload => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const storedPayload = async journal => {
    let snapshot;
    try { snapshot = JSON.parse(temporary.getItem(key) || 'null'); } catch { return null; }
    if (snapshot?.uid !== uid || snapshot.requestId !== journal.requestId || !snapshot.payload) return null;
    return await digest(snapshot.payload) === journal.digest ? snapshot.payload : null;
  };
  const owns = journal => {
    try { const saved = JSON.parse(temporary.getItem(key) || 'null'); return saved?.uid === uid && saved.requestId === journal.requestId; }
    catch { return false; }
  };
  const confirmed = journal => notify('confirmed', { number: journal.number, requestId: journal.requestId, ownsDraft: owns(journal),
    message: `Pedido ${journal.number} guardado. Puedes abrirlo sin volver a registrarlo.` });
  const uncertain = journal => notify('uncertain', { requestId: journal.requestId,
    message: 'Falta confirmar el resultado. Consulta este intento; no crees otro pedido.' });
  async function accept(data, journal) {
    const order = data?.order;
    if (data?.saved !== true || order?.requestId !== journal.requestId || !NUMBER.test(order?.number || '')
      || !['MP', 'TP'].includes(order.branch) || !order.number.startsWith(`${order.branch}-`)) {
      throw fail('INVALID_SAVE_RESPONSE', 'La respuesta no confirma este pedido. Consulta el resultado.');
    }
    sameUser();
    // Persist the receipt marker before dropping any temporary commercial data.
    const receipt = { ...journal, stage: 'confirmed', number: order.number };
    put(durable, receipt);
    if (owns(journal)) {
      try { put(temporary, { uid, requestId: journal.requestId, confirmed: true }); }
      catch { /* confirmed marker still prevents resubmission */ }
    }
    return confirmed(receipt);
  }
  async function capabilities() {
    sameUser();
    const response = await request('ORDEN_CAPACIDADES', {});
    sameUser();
    return saveCapabilitiesReady(response?.data);
  }
  async function check(journal) {
    if (journal.stage === 'confirmed') return confirmed(journal);
    notify('checking', { requestId: journal.requestId, message: 'Consultando el resultado del pedido…' });
    sameUser();
    const response = await request('ORDEN_CREACION_ESTADO', { requestId: journal.requestId });
    sameUser();
    const data = response?.data;
    if (data?.saved === true) return accept(data, journal);
    if (data?.saved === false && data.requestId === journal.requestId && data.state === 'NO_CONFIRMADO'
      && data.retrySameRequest === true && await storedPayload(journal)) {
      return notify('retry', { requestId: journal.requestId,
        message: 'No hay confirmación. Puedes reenviar el mismo intento, con sus datos originales.' });
    }
    return uncertain(journal);
  }
  const unavailable = (error, locked = true) => notify('blocked', { locked, message: error?.code === 'NO_SESSION'
    ? 'La sesión cambió. Vuelve a entrar con la cuenta que inició este pedido.'
    : 'No fue posible comprobar el guardado. Conserva esta pestaña y no borres los datos del navegador.' });
  async function exclusive(task) {
    if (busy) return copy(state);
    busy = true;
    try {
      sameUser();
      if (!locks?.request || !crypto?.randomUUID || !crypto?.subtle) {
        throw fail('RECOVERY_UNSUPPORTED', 'Este navegador no permite asegurar el guardado.');
      }
      return await locks.request(key, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return notify('other-tab', { message: 'Este pedido se está revisando en otra pestaña. Consulta el resultado antes de continuar.' });
        return task();
      });
    } catch (error) {
      let journal;
      try { journal = getJournal(); } catch { return unavailable(error); }
      return journal?.stage === 'confirmed' ? confirmed(journal) : journal ? uncertain(journal) : unavailable(error, false);
    } finally { busy = false; }
  }
  async function refresh() {
    return exclusive(async () => {
      const journal = getJournal();
      if (journal) return check(journal); // Works even when creation has since been disabled.
      const enabled = await capabilities();
      return notify(enabled ? 'ready' : 'disabled', { canSave: enabled, locked: false,
        message: enabled ? '' : 'Documento en preparación. El guardado comercial aún no está habilitado.' });
    });
  }
  async function transmit(payload, journal, firstAttempt = false) {
    notify('saving', { requestId: journal.requestId, message: 'Guardando pedido…' });
    sameUser();
    try {
      const response = await request('ORDEN_CREAR', copy(payload), { requestId: journal.requestId });
      return await accept(response?.data, journal);
    } catch (error) {
      // These contract errors are thrown BEFORE the server admits its first batch.
      // Never use a later rejection to erase a previous uncertain transmission.
      const rejected = ['ORDER_INPUT_INVALID', 'ORDER_CONTRACT_MISMATCH', 'ORDER_PHOTOS_NOT_READY', 'COMMERCIAL_WRITES_DISABLED', 'REQUEST_ID_REQUIRED'];
      if (firstAttempt && error?.requestId === journal.requestId && rejected.includes(error.code)) {
        temporary.removeItem(key);
        durable.removeItem(key);
        return notify('rejected', { locked: false, message: error.message || 'Revisa los datos antes de guardar.' });
      }
      // Unknown response: keep the identifier and frozen contents, including when
      // the server rejected the request. A status check precedes any exact replay.
      return uncertain(journal);
    }
  }
  async function save(payload) {
    // Freeze before any await: editing the form cannot change an in-flight body.
    let snapshot;
    try { snapshot = copy(payload); } catch { return unavailable(); }
    return exclusive(async () => {
      const journal = getJournal();
      if (journal) return check(journal);
      if (!await capabilities()) return notify('disabled', { locked: false,
        message: 'El guardado comercial aún no está habilitado. Conserva el borrador.' });
      const pending = { version: 1, uid, requestId: `OP-${crypto.randomUUID()}`,
        digest: await digest(snapshot), stage: 'pending' };
      // Both stores must succeed BEFORE the first POST that can create a sale.
      put(temporary, { uid, requestId: pending.requestId, payload: snapshot });
      put(durable, pending);
      return transmit(snapshot, pending, true);
    });
  }
  async function retry() {
    return exclusive(async () => {
      const journal = getJournal();
      if (!journal) return unavailable();
      const result = await check(journal);
      if (result.phase !== 'retry') return result;
      if (!await capabilities()) return uncertain(journal);
      const payload = await storedPayload(journal);
      if (!payload) return uncertain(journal);
      return transmit(payload, journal);
    });
  }
  async function startNew(beforeClear = () => {}) {
    return exclusive(async () => {
      const journal = getJournal();
      if (!journal || journal.stage !== 'confirmed') return journal ? uncertain(journal) : unavailable();
      // Explicit user action after confirmation, never automatic on page load.
      await beforeClear();
      temporary.removeItem(key);
      durable.removeItem(key);
      return notify('new', { locked: false });
    });
  }
  return { refresh, save, retry, startNew, key, getState: () => copy(state),
    hasJournal: () => { try { return Boolean(getJournal()); } catch { return true; } } };
}
