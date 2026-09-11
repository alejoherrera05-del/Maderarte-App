import { apiRequest } from '../core/api.js?v=sandbox-1';
import { APP_CONFIG } from '../core/config.js';
import { currentSandboxId } from '../core/order-sandbox-context.js';
import { createDocumentProgress } from '../core/order-progress.js?v=quote-real-1';
import { prepareQuoteMedia } from '../core/quote-media.js?v=quote-real-1';
import { createQuoteSave } from '../core/quote-save.js?v=quote-001';
import { readSessionSnapshot } from '../core/session.js';
import { waitForCommercialSession } from '../core/commercial-session.js';
import { readFurniture, readCommercialValues } from '../core/commercial-form-values.js?v=lifecycle-1';

const value = id => document.getElementById(id)?.value?.trim() || '';

function sessionReady() {
  const snapshot = readSessionSnapshot();
  return snapshot?.profile?.uid ? snapshot : null;
}

const waitForSession = () => waitForCommercialSession(sessionReady, window);

function photoMap() {
  const map = new Map();
  document.querySelectorAll('.quote-item').forEach(card => {
    const id = String(card.dataset.itemId || '');
    const photos = [...card.querySelectorAll('.quote-photo-thumb img')].map((image, index) => {
      const dataUrl = String(image.getAttribute('src') || '');
      const match = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(dataUrl);
      return match ? { name: `Referencia-${id}-${index + 1}.${match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg'}`, type: match[1], dataUrl } : null;
    }).filter(Boolean);
    map.set(id, photos);
    map.set(Number(id), photos);
  });
  return map;
}

function collectPayload() {
  const values = readCommercialValues();
  const branch = document.getElementById('quote-meta-branch')?.textContent?.trim().toUpperCase() || '';
  const items = [...document.querySelectorAll('.quote-item')].map((card, index) => {
    const item = readFurniture(card, index);
    return {
      clientLineId: String(card.dataset.itemId || index + 1),
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      unitValue: item.unitValue,
      fabric: item.fabric,
      wood: item.wood,
      specifications: item.specifications,
      photos: []
    };
  });
  return {
    schemaVersion: 1,
    branch,
    client: {
      document: value('quote-client-document'),
      name: value('quote-client-name'),
      phone: value('quote-client-phone'),
      alternatePhone: value('quote-client-alternatePhone'),
      email: value('quote-client-email'),
      address: value('quote-client-address'),
      city: value('quote-client-city')
    },
    items,
    discount: values.discount,
    notes: value('quote-notes')
  };
}

function basicValid(payload) {
  const required = [payload.branch, payload.client.document, payload.client.name, payload.client.phone, payload.client.email, payload.client.address, payload.client.city];
  if (required.some(item => !String(item || '').trim())) return false;
  if (!payload.items.length) return false;
  return payload.items.every(item => item.description && Number.isSafeInteger(item.quantity) && item.quantity > 0 && Number.isSafeInteger(item.unitValue) && item.unitValue > 0)
    && Number.isSafeInteger(payload.discount) && payload.discount >= 0;
}

async function bind() {
  if (APP_CONFIG.preview.enabled || document.body.dataset.commercialDocument !== 'quote') return;
  const form = document.getElementById('quote-form');
  const button = document.getElementById('quote-submit');
  const note = document.querySelector('.quote-write-note');
  if (!form || !button || !note) return;
  const session = await waitForSession();
  if (!session) return;

  const progress = createDocumentProgress({ kind: 'quote', mode: 'save' });
  const status = document.createElement('div');
  status.id = 'quote-save-status';
  status.className = 'quote-draft-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  note.insertAdjacentElement('afterend', status);
  const defaultNote = note.textContent;
  let locked = false;
  let manager;
  const disableForm = flag => {
    locked = flag;
    document.querySelectorAll('#quote-form input, #quote-form select, #quote-form textarea, #quote-form button, #quote-change-branch, [data-quote-branch], #quote-preview-button')
      .forEach(node => { if (node !== button && !status.contains(node)) node.disabled = flag; });
  };
  const action = (label, handler) => {
    const control = document.createElement('button'); control.type = 'button'; control.className = 'quote-secondary-action'; control.textContent = label;
    control.addEventListener('click', () => void handler()); status.append(control);
  };
  const openQuote = number => window.location.assign(`/cotizacion-ver.html?cot=${encodeURIComponent(number)}${currentSandboxId() ? `&prueba=${encodeURIComponent(currentSandboxId())}` : ''}`);

  function render(state) {
    disableForm(Boolean(state.locked));
    progress.sync(state);
    button.disabled = !state.canSave;
    button.textContent = state.phase === 'saving' ? 'Emitiendo cotización…' : state.phase === 'documents' ? 'Documentos pendientes' : state.phase === 'confirmed' ? 'Cotización emitida' : 'Emitir cotización';
    button.setAttribute('aria-busy', String(['saving','checking'].includes(state.phase)));
    note.textContent = ['ready','disabled'].includes(state.phase) ? (state.phase === 'ready' ? 'Al emitir, Maddy asignará el consecutivo real y archivará la cotización en Drive.' : defaultNote) : state.message;
    status.replaceChildren();
    status.hidden = state.working === true || !['disabled','uncertain','retry','confirmed','documents','other-tab','blocked','rejected'].includes(state.phase);
    if (!status.hidden) {
      if (state.phase === 'confirmed') {
        action('Abrir cotización', () => openQuote(state.number));
        action('Nueva cotización', async () => {
          const result = await manager.startNew();
          if (result.phase === 'new') window.location.reload();
        });
      } else if (state.phase === 'documents') {
        action('Completar archivo', () => manager.refresh());
        if (state.number) action('Abrir cotización registrada', () => openQuote(state.number));
      } else {
        action(state.locked ? 'Consultar resultado' : 'Comprobar disponibilidad', () => manager.refresh());
        if (state.phase === 'retry') action('Reenviar el mismo intento', () => manager.retry());
      }
    }
  }

  manager = createQuoteSave({
    uid: session.profile.uid,
    scope: currentSandboxId(),
    request: apiRequest,
    durable: window.localStorage,
    temporary: window.sessionStorage,
    locks: window.navigator.locks,
    crypto: window.crypto,
    activeUid: () => readSessionSnapshot()?.profile?.uid || '',
    onState: render,
    onProgress: progress.update
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (locked) return;
    const payload = collectPayload();
    if (!basicValid(payload)) return;
    let prepared;
    try {
      disableForm(true); button.disabled = true;
      progress.begin();
      progress.update({ step: 'prepare', status: 'running' });
      prepared = await prepareQuoteMedia(payload, photoMap(), progress.update);
      progress.update({ step: 'prepare', status: 'complete' });
    } catch (error) {
      disableForm(false); button.disabled = !manager.getState().canSave;
      progress.pause(error.message || 'No se pudieron preparar las referencias.'); return;
    }
    const result = await manager.save(prepared);
    if (result.phase === 'confirmed') openQuote(result.number);
  });

  window.addEventListener('storage', event => { if (event.key === manager.key) void manager.refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) void manager.refresh(); });
  window.addEventListener('beforeunload', event => {
    if (locked && manager.getState().phase !== 'confirmed') { event.preventDefault(); event.returnValue = ''; }
  });
  await manager.refresh();
}

void bind();
