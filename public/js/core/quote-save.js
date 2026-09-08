import { finishQuoteDocuments } from './quote-media.js?v=quote-real-1';

export const QUOTE_SAVE_PREFIX = 'maderarte.quote-save.v1.';
const ID = /^[A-Za-z0-9_-]{16,120}$/;
const NUMBER = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{4,}$/;
const copy = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => Object.assign(new Error(message), { code });

export function quoteCapabilitiesReady(value) {
  return value?.contractVersion === 1 && value.enabled === true && value.photosReady === true && value.documentsReady === true;
}

export function createQuoteSave({ uid, request, durable, temporary, locks, crypto, activeUid = () => uid, onState = () => {}, onProgress = () => {}, scope = '' }) {
  if (!uid) throw fail('NO_SESSION', 'Inicia sesión nuevamente.');
  if (scope && !/^QA-[a-f0-9]{32}$/.test(scope)) throw fail('SANDBOX_INVALID', 'Ensayo no válido.');
  const key = `${QUOTE_SAVE_PREFIX}${encodeURIComponent(uid)}${scope ? '.' + scope : ''}`;
  const progress = event => { try { onProgress(event); } catch {} };
  let busy = false;
  let supportsMedia = false;
  let state = { phase: 'disabled', canSave: false, locked: false, message: '' };
  const notify = (phase, options = {}) => {
    state = { phase, canSave: false, locked: true, message: '', ...options };
    onState(copy(state));
    return copy(state);
  };
  const sameUser = () => { if (activeUid() !== uid) throw fail('NO_SESSION', 'Inicia sesión con la cuenta que comenzó esta cotización.'); };
  const digest = async payload => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const getJournal = () => {
    const raw = durable.getItem(key);
    if (!raw) return null;
    let value;
    try { value = JSON.parse(raw); } catch {}
    if (!value || value.version !== 1 || value.uid !== uid || !ID.test(value.requestId)
      || !/^[a-f0-9]{64}$/.test(value.digest) || !['pending', 'documents', 'confirmed'].includes(value.stage)
      || (['documents', 'confirmed'].includes(value.stage) && !NUMBER.test(value.number))) {
      throw fail('LOCAL_RECOVERY_REQUIRED', 'El registro de emisión necesita revisión. No borres los datos del navegador.');
    }
    return value;
  };
  const put = (storage, value) => {
    const serialized = JSON.stringify(value); storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw fail('STORAGE_UNAVAILABLE', 'No se pudo asegurar la recuperación de la cotización.');
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
    message: `Cotización ${journal.number} emitida y archivada. Puedes abrirla sin volver a registrarla.` });
  const uncertain = journal => notify('uncertain', { requestId: journal.requestId,
    message: 'Falta confirmar el resultado. Consulta este mismo intento; no emitas otra cotización.' });
  const documentPending = (journal, message, working = false) => notify('documents', { working, number: journal.number, requestId: journal.requestId, ownsDraft: owns(journal),
    message: message || `Cotización ${journal.number} registrada. Falta completar su archivo; se retomará la misma cotización.` });

  async function completeDocuments(journal) {
    progress({ step: 'prepare', status: 'complete' });
    progress({ step: 'record', status: 'complete', number: journal.number });
    documentPending(journal, 'Completando referencias y PDF de la cotización registrada…', true);
    try {
      sameUser();
      const payload = await storedPayload(journal);
      await finishQuoteDocuments(journal.number, payload?._media || [], async (...args) => {
        sameUser(); const response = await request(...args); sameUser(); return response;
      }, message => documentPending(journal, message, true), progress);
      const receipt = { ...journal, stage: 'confirmed' };
      put(durable, receipt);
      if (owns(journal)) { try { put(temporary, { uid, requestId: journal.requestId, confirmed: true }); } catch {} }
      return confirmed(receipt);
    } catch (error) {
      return documentPending(journal, error?.message || 'La cotización quedó registrada, pero falta confirmar sus documentos.');
    }
  }

  async function accept(data, journal) {
    const quote = data?.quote;
    if (data?.saved !== true || quote?.requestId !== journal.requestId || !NUMBER.test(quote?.number || '') || !['MP','TP'].includes(quote.branch)) {
      throw fail('INVALID_SAVE_RESPONSE', 'La respuesta no confirma esta cotización. Consulta el resultado.');
    }
    sameUser();
    const receipt = { ...journal, stage: quote.mediaWorkflow === 1 ? 'documents' : 'confirmed', number: quote.number };
    put(durable, receipt);
    return receipt.stage === 'documents' ? completeDocuments(receipt) : confirmed(receipt);
  }

  async function capabilities() {
    sameUser(); const response = await request('COTIZACION_CAPACIDADES', {}); sameUser();
    supportsMedia = response?.data?.photosReady === true;
    return quoteCapabilitiesReady(response?.data);
  }

  async function check(journal) {
    if (journal.stage === 'confirmed') return confirmed(journal);
    if (journal.stage === 'documents') return completeDocuments(journal);
    notify('checking', { requestId: journal.requestId, message: 'Consultando el resultado de esta emisión…' });
    sameUser(); const response = await request('COTIZACION_CREACION_ESTADO', { requestId: journal.requestId }); sameUser();
    const data = response?.data;
    if (data?.saved === true) return accept(data, journal);
    if (data?.saved === false && data.requestId === journal.requestId && data.retrySameRequest === true && await storedPayload(journal)) {
      return notify('retry', { requestId: journal.requestId, message: 'Google no confirmó una cotización con este identificador. Puedes reenviar exactamente el mismo intento.' });
    }
    return uncertain(journal);
  }

  const unavailable = (error, locked = true) => notify('blocked', { locked, message: error?.code === 'NO_SESSION'
    ? 'La sesión cambió. Vuelve a entrar con la cuenta que inició esta cotización.'
    : 'No fue posible comprobar la emisión. Conserva esta pestaña y no borres los datos del navegador.' });

  async function exclusive(task) {
    if (busy) return copy(state);
    busy = true;
    try {
      sameUser();
      if (!locks?.request || !crypto?.randomUUID || !crypto?.subtle) throw fail('RECOVERY_UNSUPPORTED', 'Este navegador no permite asegurar la emisión.');
      return await locks.request(key, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return notify('other-tab', { message: 'Esta cotización se está revisando en otra pestaña. Consulta el resultado antes de continuar.' });
        return task();
      });
    } catch (error) {
      let journal;
      try { journal = getJournal(); } catch { return unavailable(error); }
      return journal?.stage === 'confirmed' ? confirmed(journal) : journal?.stage === 'documents' ? documentPending(journal) : journal ? uncertain(journal) : unavailable(error, false);
    } finally { busy = false; }
  }

  async function refresh() {
    return exclusive(async () => {
      const journal = getJournal();
      if (journal) return check(journal);
      const enabled = await capabilities();
      return notify(enabled ? 'ready' : 'disabled', { canSave: enabled, mediaEnabled: supportsMedia, locked: false,
        message: enabled ? '' : 'La emisión real de cotizaciones todavía está en preparación.' });
    });
  }

  async function transmit(payload, journal, firstAttempt = false) {
    notify('saving', { requestId: journal.requestId, message: 'Registrando cotización…' });
    progress({ step: 'record', status: 'running' });
    sameUser();
    try {
      const command = copy(payload); delete command._media;
      const response = await request('COTIZACION_CREAR', command, { requestId: journal.requestId });
      return await accept(response?.data, journal);
    } catch (error) {
      const rejected = ['QUOTE_INPUT_INVALID','QUOTE_CONTRACT_MISMATCH','QUOTE_PHOTOS_NOT_READY','COMMERCIAL_WRITES_DISABLED','REQUEST_ID_REQUIRED'];
      if (firstAttempt && error?.requestId === journal.requestId && rejected.includes(error.code)) {
        temporary.removeItem(key); durable.removeItem(key);
        return notify('rejected', { locked: false, message: error.message || 'Revisa los datos antes de emitir.' });
      }
      return uncertain(journal);
    }
  }

  async function save(payload) {
    let snapshot;
    try { snapshot = copy(payload); } catch { return unavailable(); }
    return exclusive(async () => {
      const journal = getJournal();
      if (journal) return check(journal);
      if (!await capabilities()) return notify('disabled', { locked: false, message: 'La emisión real aún no está habilitada. Conserva el borrador.' });
      if (snapshot._media?.length && !supportsMedia) return notify('disabled', { locked: false, message: 'El servidor todavía no admite referencias de cotización.' });
      const pending = { version: 1, uid, requestId: `QT-${crypto.randomUUID()}`, digest: await digest(snapshot), stage: 'pending' };
      put(temporary, { uid, requestId: pending.requestId, payload: snapshot });
      put(durable, pending);
      return transmit(snapshot, pending, true);
    });
  }

  async function retry() {
    return exclusive(async () => {
      const journal = getJournal(); if (!journal) return unavailable();
      const result = await check(journal); if (result.phase !== 'retry') return result;
      if (!await capabilities()) return uncertain(journal);
      const payload = await storedPayload(journal); if (!payload) return uncertain(journal);
      return transmit(payload, journal);
    });
  }

  async function startNew(beforeClear = () => {}) {
    return exclusive(async () => {
      const journal = getJournal();
      if (!journal || journal.stage !== 'confirmed') return journal ? uncertain(journal) : unavailable();
      await beforeClear(); temporary.removeItem(key); durable.removeItem(key);
      return notify('new', { locked: false });
    });
  }

  return { refresh, save, retry, startNew, key, getState: () => copy(state), hasJournal: () => { try { return Boolean(getJournal()); } catch { return true; } } };
}
