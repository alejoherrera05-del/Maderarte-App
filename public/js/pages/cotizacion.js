import { apiRequest } from '../core/api.js';
import { APP_CONFIG, withPreview } from '../core/config.js';
import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { COMMERCIAL_DOCUMENT } from '../core/commercial-document.js?v=agreements-1';
import { openDocumentPreview, closeDocumentPreview } from './cotizacion-document-polish.js?v=agreements-1';
import { previewApiData } from '../core/auth.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { escapeHtml } from '../core/format.js';
import { bindClientLookup } from '../core/client-lookup.js?v=agreements-1';
import { ITEM_FULFILLMENTS, ITEM_AGREEMENTS, paymentAmount } from '../core/commercial-rules.js?v=agreements-1';
import { bindOrderEntry, readOrderEntry, syncOrderAllocation } from '../core/order-entry.js?v=agreements-1';

import { bindFormDraft } from '../core/form-draft.js?v=agreements-1';
import { readFurniture, readCommercialValues } from '../core/commercial-form-values.js?v=agreements-1';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const BRANCH_FALLBACKS = Object.freeze({
  MP: { branch: 'MP', branchName: 'Maderarte Principal' },
  TP: { branch: 'TP', branchName: 'Maderarte Terraplaza' }
});

const state = {
  session: null,
  quoteMeta: null,
  nextItemId: 1,
  photos: new Map()
};

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? moneyFormatter.format(number) : '—';
}

function parseMoney(value) {
  return paymentAmount(value);
}

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function hasPermission(permission) {
  const permissions = Array.isArray(state.session?.permissions) ? state.session.permissions : [];
  const scope = String(permission || '').split('.')[0];
  return permissions.includes('*') || permissions.includes(permission) || permissions.includes(`${scope}.*`);
}

function allowedBranches() {
  const profile = state.session?.profile || {};
  const branches = Array.isArray(profile.branches) ? profile.branches : [];
  const normalized = branches.map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
  if (normalized.length) return normalized;
  return profile.mainBranch ? [String(profile.mainBranch).trim().toUpperCase()] : [];
}

async function confirmZeroClients() {
  if (!hasPermission('config.read')) return false;
  try {
    const response = await apiRequest('SISTEMA_ESTADO', {});
    return Number(response.data?.counts?.clients ?? -1) === 0;
  } catch {
    return false;
  }
}

async function requestClients(payload = {}) {
  const preview = previewApiData('CLIENTES_LISTAR');
  if (preview) return preview;
  try {
    return await apiRequest('CLIENTES_LISTAR', payload);
  } catch (error) {
    if (String(error?.code || '') === 'ACTION_NOT_FOUND' && await confirmZeroClients()) {
      return { status: 'success', code: 'BASE_ZERO_COMPAT', data: { items: [], total: 0 } };
    }
    throw error;
  }
}

function fallbackQuoteMeta(branch) {
  const base = BRANCH_FALLBACKS[branch] || { branch, branchName: branch };
  const companyLocation = companyBranch(branch);
  return {
    ...base,
    branchAddress: companyLocation?.address || '',
    branchPhone: COMPANY_PROFILE.mobile,
    previewNumber: '',
    numberStatus: 'PENDIENTE',
    issuedAt: new Date().toISOString(),
    advisor: state.session?.profile?.name || '',
    company: COMPANY_PROFILE
  };
}

async function requestQuoteMeta(branch) {
  // A draft order must never consume or display a quotation consecutive.
  if (COMMERCIAL_DOCUMENT.isOrder || APP_CONFIG.preview.enabled) return fallbackQuoteMeta(branch);
  try {
    const response = await apiRequest('COTIZACION_META', { branch });
    return { ...fallbackQuoteMeta(branch), ...(response.data || {}) };
  } catch (error) {
    if (String(error?.code || '') === 'ACTION_NOT_FOUND') return fallbackQuoteMeta(branch);
    throw error;
  }
}

function renderBranchAvailability() {
  const available = allowedBranches();
  document.querySelectorAll('[data-quote-branch]').forEach(button => {
    const branch = String(button.dataset.quoteBranch || '').toUpperCase();
    const allowed = !available.length || available.includes(branch);
    button.hidden = !allowed;
    button.disabled = !allowed;
  });
}

function setGateMessage(value = '', error = false) {
  const message = document.getElementById('quote-gate-message');
  if (!message) return;
  message.textContent = value;
  message.classList.toggle('is-error', Boolean(error));
}

function setGateBusy(busy) {
  document.querySelectorAll('[data-quote-branch]').forEach(button => {
    if (!button.hidden) button.disabled = Boolean(busy);
  });
  document.getElementById('quote-gate-options')?.classList.toggle('is-busy', Boolean(busy));
}

function updateDocumentMeta() {
  const meta = state.quoteMeta || fallbackQuoteMeta('');
  const number = meta.previewNumber || COMMERCIAL_DOCUMENT.pendingNumber;
  const status = meta.previewNumber ? 'Consecutivo previsto' : 'Se asigna al guardar';
  const numberEl = document.getElementById('quote-meta-number');
  const statusEl = document.getElementById('quote-number-status');
  const dateEl = document.getElementById('quote-meta-date');
  const advisorEl = document.getElementById('quote-meta-advisor');
  const branchEl = document.getElementById('quote-meta-branch');
  const branchNameEl = document.getElementById('quote-meta-branch-name');
  if (numberEl) numberEl.textContent = number;
  if (statusEl) statusEl.textContent = status;
  if (dateEl) dateEl.textContent = formatDate(meta.issuedAt);
  if (advisorEl) advisorEl.textContent = meta.advisor || state.session?.profile?.name || '—';
  if (branchEl) branchEl.textContent = meta.branch || '—';
  if (branchNameEl) branchNameEl.textContent = meta.branchName || 'Sede sin definir';
}

async function selectBranch(branch) {
  const code = String(branch || '').trim().toUpperCase();
  const available = allowedBranches();
  if (!Object.hasOwn(BRANCH_FALLBACKS, code) || (available.length && !available.includes(code))) return;
  const selectionTrigger = document.activeElement;
  setGateBusy(true);
  setGateMessage('Preparando los datos de emisión…');
  try {
    state.quoteMeta = await requestQuoteMeta(code);
    updateDocumentMeta();
    document.getElementById('quote-workspace').hidden = false;
    document.getElementById('quote-preview-button').disabled = false;
    document.getElementById('quote-branch-gate').classList.add('is-closed');
    setGateMessage('');
    state.draft?.save();
    window.setTimeout(() => {
      const idleFocus = document.activeElement === document.body || document.activeElement === selectionTrigger;
      if (idleFocus && !window.matchMedia?.('(pointer: coarse)').matches) {
        document.getElementById('quote-client-document')?.focus({ preventScroll: true });
      }
    }, 340);
  } catch (error) {
    setGateMessage(error.message || 'No fue posible preparar la sede seleccionada.', true);
  } finally {
    setGateBusy(false);
  }
}

function openBranchGate() {
  const gate = document.getElementById('quote-branch-gate');
  gate?.classList.remove('is-closed');
  setGateMessage(state.quoteMeta ? 'Selecciona la sede del documento.' : '');
}

function itemMarkup(id) {
  return `<article class="quote-item" data-item-id="${id}">
    <div class="quote-item-head">
      <div class="quote-item-index"><span data-item-position>01</span><div><strong>Mueble</strong><small data-item-caption>Descripción, valor y acuerdos</small></div></div>
      <button class="quote-remove-item" type="button" data-remove-item>Eliminar</button>
    </div>
    <div class="quote-item-grid quote-item-essential">
      <div class="quote-field quote-item-description"><label for="quote-item-${id}-description">¿Qué mueble lleva?</label><input id="quote-item-${id}-description" data-field="description" placeholder="Ej. Sala Oslo de 2.10 m" required></div>
      <div class="quote-field quote-item-quantity"><label for="quote-item-${id}-quantity">Cantidad</label><input id="quote-item-${id}-quantity" data-field="quantity" type="number" min="1" step="1" value="1" inputmode="numeric" required></div>
      <div class="quote-field quote-item-value"><label for="quote-item-${id}-unitValue">Precio por unidad</label><input id="quote-item-${id}-unitValue" data-field="unitValue" inputmode="numeric" placeholder="$ 0" required></div>
      <div class="quote-item-line-total"><span>Total de este mueble</span><strong data-line-total>$ 0</strong></div>
    </div>
    ${COMMERCIAL_DOCUMENT.isOrder ? `<div class="order-item-agreements">
      <div class="quote-field"><label for="order-item-${id}-agreement">¿Qué acordamos con este mueble?</label>
        <select id="order-item-${id}-agreement" data-item-agreement required aria-describedby="order-item-${id}-agreement-help"><option value="">Seleccionar acuerdo</option>${ITEM_AGREEMENTS.map(option => `<option value="${option.code}">${escapeHtml(option.label)}</option>`).join('')}</select>
        <p class="quote-helper" id="order-item-${id}-agreement-help" data-agreement-help role="status"></p>
      </div>
      <div class="quote-field" data-availability-field hidden><label for="order-item-${id}-fulfillment">¿Está disponible o necesita fábrica?</label>
        <select id="order-item-${id}-fulfillment" data-item-fulfillment aria-describedby="order-item-${id}-help"><option value="">Seleccionar disponibilidad</option>${ITEM_FULFILLMENTS.map(option => `<option value="${option.code}">${escapeHtml(option.code === 'DISPONIBLE' ? 'Está disponible' : option.code === 'PARA_SOLICITAR' ? 'Necesita fábrica' : 'Aún por definir')}</option>`).join('')}</select>
        <p class="quote-helper" id="order-item-${id}-help" data-fulfillment-help role="status"></p>
      </div>
    </div>` : ''}
    <details class="quote-item-details"><summary>Personalización y referencias <span>Opcional</span></summary>
      <div class="quote-item-grid quote-item-customization">
        <div class="quote-field quote-item-category"><label for="quote-item-${id}-category">Categoría</label><select id="quote-item-${id}-category" data-field="category"><option value="">Seleccionar</option><option value="SALA">Sala</option><option value="COMEDOR">Comedor</option><option value="ALCOBA">Alcoba</option><option value="INFANTIL">Infantil</option><option value="OFICINA">Oficina</option><option value="COMPLEMENTO">Complemento</option><option value="OTRO">Otro</option></select></div>
        <div class="quote-field quote-item-fabric"><label for="quote-item-${id}-fabric">Tela / acabado</label><input id="quote-item-${id}-fabric" data-field="fabric" placeholder="Tela, tono o textura"></div>
        <div class="quote-field quote-item-wood"><label for="quote-item-${id}-wood">Madera / acabado</label><input id="quote-item-${id}-wood" data-field="wood" placeholder="Madera, pintura o tono"></div>
        <div class="quote-field quote-item-specifications"><label for="quote-item-${id}-specifications">Medidas y especificaciones</label><textarea id="quote-item-${id}-specifications" data-field="specifications" rows="3" placeholder="Medidas, distribución, espuma, herrajes o cambios especiales…"></textarea></div>
      </div>
      <div class="quote-photo-area">
        <div class="quote-photo-head"><div><strong>Referencias visuales</strong><span>Fotos o bocetos de este mueble.</span></div><small>Se incluyen en el anexo del documento.</small></div>
        <button class="quote-photo-drop" type="button" data-add-photos><span class="quote-photo-plus">＋</span><span><strong>Agregar fotografías</strong><small>Puedes seleccionar varias imágenes.</small></span></button>
        <input class="quote-photo-input" data-photo-input type="file" accept="image/*" multiple>
        <div class="quote-photo-list" data-photo-list></div>
      </div>
    </details>
  </article>`;
}

function renumberItems() {
  const cards = Array.from(document.querySelectorAll('.quote-item'));
  cards.forEach((card, index) => {
    const position = card.querySelector('[data-item-position]');
    if (position) position.textContent = String(index + 1).padStart(2, '0');
    const remove = card.querySelector('[data-remove-item]');
    if (remove) remove.disabled = cards.length === 1;
  });
  const count = document.getElementById('quote-item-count');
  if (count) count.textContent = `${cards.length} ${cards.length === 1 ? 'mueble' : 'muebles'}`;
}

function renderPhotos(itemId) {
  const card = document.querySelector(`.quote-item[data-item-id="${itemId}"]`);
  const list = card?.querySelector('[data-photo-list]');
  if (!list) return;
  const photos = state.photos.get(itemId) || [];
  list.innerHTML = photos.map((photo, index) => `<div class="quote-photo-thumb"><img src="${escapeHtml(photo.dataUrl)}" alt="Referencia ${index + 1} del mueble"><button class="quote-photo-remove" type="button" data-remove-photo="${index}" aria-label="Eliminar fotografía">×</button></div>`).join('');
  list.querySelectorAll('[data-remove-photo]').forEach(button => {
    button.addEventListener('click', () => {
      const current = state.photos.get(itemId) || [];
      current.splice(Number(button.dataset.removePhoto), 1);
      state.photos.set(itemId, current);
      renderPhotos(itemId);
      state.draft?.changed();
    });
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: String(reader.result || '') });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addPhotos(itemId, files) {
  const images = Array.from(files || []).filter(file => String(file.type || '').startsWith('image/'));
  if (!images.length) return;
  const loaded = await Promise.all(images.map(readFile));
  const current = state.photos.get(itemId) || [];
  state.photos.set(itemId, current.concat(loaded));
  renderPhotos(itemId);
  state.draft?.changed();
}

function bindItem(card) {
  const itemId = Number(card.dataset.itemId);
  card.querySelector('[data-remove-item]')?.addEventListener('click', () => {
    if (document.querySelectorAll('.quote-item').length <= 1) return;
    state.photos.delete(itemId);
    card.remove();
    renumberItems();
    calculate();
    state.draft?.changed();
  });

  card.querySelectorAll('[data-field="quantity"], [data-field="unitValue"]').forEach(input => {
    input.addEventListener('input', calculate);
  });

  const unitValue = card.querySelector('[data-field="unitValue"]');
  unitValue?.addEventListener('blur', () => {
    const value = parseMoney(unitValue.value);
    if (Number.isFinite(value)) unitValue.value = value ? money(value) : '';
  });
  unitValue?.addEventListener('focus', () => {
    const value = parseMoney(unitValue.value);
    if (Number.isFinite(value)) unitValue.value = value ? String(value) : '';
  });

  const agreement = card.querySelector('[data-item-agreement]');
  agreement?.addEventListener('change', () => {
    const choice = ITEM_AGREEMENTS.find(option => option.code === agreement.value);
    card.querySelector('[data-agreement-help]').textContent = choice?.help || '';
    const availability = card.querySelector('[data-availability-field]');
    availability.hidden = !choice || choice.code === 'ENTREGA_HOY';
    calculate();
  });
  card.querySelector('[data-field="description"]').addEventListener('input', calculate);
  const fulfillment = card.querySelector('[data-item-fulfillment]');
  fulfillment?.addEventListener('change', () => {
    const choice = ITEM_FULFILLMENTS.find(option => option.code === fulfillment.value);
    const help = card.querySelector('[data-fulfillment-help]');
    help.textContent = choice?.help || 'Selecciona la disponibilidad de este mueble.';
    help.classList.remove('is-error');
    fulfillment.removeAttribute('aria-invalid');
    calculate();
  });

  const photoInput = card.querySelector('[data-photo-input]');
  card.querySelector('[data-add-photos]')?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async () => {
    await addPhotos(itemId, photoInput.files);
    photoInput.value = '';
  });
}

function addItem(restoredId) {
  const root = document.getElementById('quote-items');
  if (!root) return;
  const id = Number.isSafeInteger(restoredId) && restoredId > 0 ? restoredId : state.nextItemId++;
  state.nextItemId = Math.max(state.nextItemId, id + 1);
  root.insertAdjacentHTML('beforeend', itemMarkup(id));
  state.photos.set(id, []);
  const card = root.querySelector(`.quote-item[data-item-id="${id}"]`);
  if (card) bindItem(card);
  renumberItems();
  calculate();
  state.draft?.changed();
}

function calculate() {
  const values = readCommercialValues();
  [...document.querySelectorAll('.quote-item')].forEach((card, index) => {
    const item = values.items[index];
    card.querySelector('[data-line-total]').textContent = money(item.subtotal);
    card.querySelector('[data-item-caption]').textContent = item.description || 'Descripción, valor y acuerdos';
  });
  document.getElementById('quote-subtotal').textContent = money(values.subtotal);
  document.getElementById('quote-total').textContent = money(values.total);
  if (COMMERCIAL_DOCUMENT.isOrder) {
    document.getElementById('order-discount-summary').textContent = money(values.discount);
    syncOrderAllocation(values, calculate);
    const entry = readOrderEntry(values.total);
    document.getElementById('order-paid').textContent = money(entry.paid);
    document.getElementById('order-balance').textContent = Number.isFinite(values.total) ? money(Math.max(0, values.total - entry.paid)) : '—';
    const hasPaymentContent = [...document.querySelectorAll('[data-payment-row] input, [data-payment-row] select')].some(input => input.value);
    document.getElementById('order-payment-error').textContent = hasPaymentContent || state.validating ? entry.error : '';
    const noPayment = document.getElementById('order-no-payment').checked;
    document.getElementById('order-payment-editor').hidden = noPayment && !hasPaymentContent;
    document.getElementById('order-allocation-error').textContent = entry.allocate ? entry.allocationError : '';
    const assigned = entry.allocation.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
    document.getElementById('order-allocation-total').textContent = entry.allocate ? `Abono: ${money(entry.paid)} · Asignado: ${money(assigned)} · ${assigned > entry.paid ? 'Exceso' : 'Falta'}: ${money(Math.abs(entry.paid - assigned))}` : '';
    document.getElementById('order-operational-summary').replaceChildren(...values.items.map(item => {
      const row = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = item.description || `Mueble ${item.position}`;
      const detail = document.createElement('span');
      detail.textContent = item.agreement ? `${item.quantity || '—'} · ${item.agreement.label}${item.fulfillment?.code === 'PARA_SOLICITAR' ? ' · necesita fábrica' : ''}` : 'Acuerdo pendiente';
      row.append(title, detail);
      return row;
    }));
    for (const [id, value] of [['order-live-total', values.total], ['order-live-paid', entry.paid], ['order-live-balance', Number.isFinite(values.total) ? Math.max(0, values.total - entry.paid) : NaN]]) {
      document.getElementById(id).textContent = money(value);
    }
  }
}

function showFieldError(input, message) {
  if (!input) return;
  input.setAttribute('aria-invalid', 'true');
  const details = input.closest('details');
  if (details) details.open = true;
  const field = input.closest('.quote-field') || input.closest('.quote-discount-field');
  let error = field?.querySelector('[data-field-error]');
  if (field && !error) {
    error = document.createElement('p');
    error.className = 'quote-helper is-error';
    error.dataset.fieldError = '';
    error.id = `${input.id}-error`;
    field.append(error);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
  }
  if (error) error.textContent = message;
  document.getElementById('quote-form-error').textContent = message;
  input.focus();
}

function validateForm() {
  const missing = (selector, message, invalid) => {
    const input = document.querySelector(selector);
    if (input && (invalid ? invalid(input) : !input.value.trim())) { showFieldError(input, message); return true; }
    return false;
  };
  for (const [selector, message] of [
    ['#quote-client-document', 'Escribe la cédula o NIT del cliente.'],
    ['#quote-client-name', 'Escribe el nombre del cliente.'],
    ['#quote-client-phone', 'Escribe un teléfono de contacto.']
  ]) if (missing(selector, message)) return false;
  if (missing('#quote-client-email', 'Revisa el formato del correo o déjalo vacío.', input => Boolean(input.value && !input.validity.valid))) return false;
  for (const card of document.querySelectorAll('.quote-item')) {
    const prefix = `.quote-item[data-item-id="${card.dataset.itemId}"]`;
    const item = readFurniture(card);
    if (missing(`${prefix} [data-field="description"]`, 'Describe el mueble que estás incluyendo.')) return false;
    if (missing(`${prefix} [data-field="quantity"]`, 'La cantidad debe ser un número entero mayor que cero.', () => !Number.isSafeInteger(item.quantity))) return false;
    if (missing(`${prefix} [data-field="unitValue"]`, 'Escribe un precio mayor que cero, en pesos completos y sin negativos.', () => !Number.isSafeInteger(item.unitValue) || item.unitValue <= 0 || !Number.isSafeInteger(item.subtotal))) return false;
    if (COMMERCIAL_DOCUMENT.isOrder) {
      if (missing(`${prefix} [data-item-agreement]`, 'Selecciona qué acordaron para este mueble.', () => !item.agreement)) return false;
      if (missing(`${prefix} [data-item-fulfillment]`, 'Selecciona la disponibilidad de este mueble.', () => !item.fulfillment)) return false;
    }
  }
  const values = readCommercialValues();
  if (missing('#quote-discount', 'El descuento debe ser válido y no superar el subtotal.', () => !Number.isSafeInteger(values.total))) return false;
  if (COMMERCIAL_DOCUMENT.isOrder) {
    const entry = readOrderEntry(values.total);
    if (entry.error) {
      const row = document.querySelectorAll('[data-payment-row]')[entry.errorIndex];
      const method = row?.querySelector('[data-payment-method]');
      showFieldError(method?.value ? row.querySelector('[data-payment-amount]') : method, entry.error);
      return false;
    }
    if (entry.allocationError) {
      const input = [...document.querySelectorAll('[data-item-allocation]')].find(node => node.dataset.itemAllocation === entry.allocationErrorId) || document.querySelector('[data-item-allocation]');
      showFieldError(input, entry.allocationError);
      return false;
    }
  }
  return true;
}

function openPreview() {
  if (!state.quoteMeta) { openBranchGate(); return; }
  state.validating = true;
  calculate();
  if (!validateForm()) return;
  document.getElementById('quote-form-error').textContent = '';
  openDocumentPreview();
}

function bindGlobalInteractions() {
  document.querySelectorAll('[data-quote-branch]').forEach(button => {
    button.addEventListener('click', () => selectBranch(button.dataset.quoteBranch));
  });
  document.getElementById('quote-change-branch')?.addEventListener('click', openBranchGate);
  document.getElementById('quote-add-item')?.addEventListener('click', addItem);
  document.getElementById('quote-preview-button')?.addEventListener('click', openPreview);
  document.getElementById('quote-summary-preview')?.addEventListener('click', openPreview);
  document.getElementById('quote-preview-close')?.addEventListener('click', closeDocumentPreview);
  document.getElementById('quote-preview-overlay')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeDocumentPreview();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('quote-preview-overlay')?.classList.contains('is-open')) closeDocumentPreview();
  });

  const discount = document.getElementById('quote-discount');
  discount?.addEventListener('input', calculate);
  discount?.addEventListener('blur', () => {
    const value = parseMoney(discount.value);
    if (Number.isFinite(value)) discount.value = value ? money(value) : '';
    calculate();
  });
  discount?.addEventListener('focus', () => {
    const value = parseMoney(discount.value);
    if (Number.isFinite(value)) discount.value = value ? String(value) : '';
  });

  bindClientLookup({
    input: document.getElementById('quote-client-document'),
    list: document.getElementById('quote-client-suggestions'),
    message: document.getElementById('quote-client-message'),
    fields: Object.fromEntries(['name', 'phone', 'alternatePhone', 'email', 'address', 'city'].map(key => [key, document.getElementById(`quote-client-${key}`)])),
    onSelect: () => state.draft?.changed(),
    async search(query) {
      const response = await requestClients({ query, limit: 8 });
      return response.data?.items || [];
    },
    async load(document) {
      const response = previewApiData('CLIENTE_OBTENER') || await apiRequest('CLIENTE_OBTENER', { document });
      return response.data?.client || null;
    }
  });
  const form = document.getElementById('quote-form');
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    const error = event.target.closest('.quote-field, .quote-discount-field')?.querySelector('[data-field-error]');
    if (error) error.textContent = '';
    document.getElementById('quote-form-error').textContent = '';
  });
  form.addEventListener('change', event => {
    event.target.removeAttribute('aria-invalid');
    const error = event.target.closest('.quote-field')?.querySelector('[data-field-error]');
    if (error) error.textContent = '';
  });
}

function captureDraft() {
  return {
    branch: state.quoteMeta?.branch || '',
    itemIds: [...document.querySelectorAll('.quote-item')].map(card => Number(card.dataset.itemId)),
    paymentIds: [...document.querySelectorAll('[data-payment-row]')].map(row => Number(row.dataset.paymentRow)),
    fields: [...document.querySelectorAll('#quote-form input[id]:not([type=file]), #quote-form select[id], #quote-form textarea[id]')]
      .map(input => ({ id: input.id, value: input.value, checked: input.checked })),
    photos: [...state.photos].filter(([, photos]) => photos.length)
  };
}

async function restoreDraft(data) {
  if (!data || !Array.isArray(data.itemIds) || !data.itemIds.length || data.itemIds.length > 100
    || !data.itemIds.every(id => Number.isSafeInteger(id) && id > 0) || new Set(data.itemIds).size !== data.itemIds.length
    || !Array.isArray(data.fields) || data.fields.length > 2000
    || !Array.isArray(data.paymentIds) || data.paymentIds.length > 100
    || !data.paymentIds.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Borrador incompatible');
  document.getElementById('quote-items').replaceChildren();
  state.photos.clear();
  data.itemIds.forEach(addItem);
  if (state.payments) { state.payments.clear(); data.paymentIds.forEach(state.payments.addPayment); }
  for (const saved of data.fields) {
    const input = document.getElementById(saved.id);
    if (!input?.closest('#quote-form') || input.type === 'file') continue;
    input.value = typeof saved.value === 'string' ? saved.value : '';
    if (input.type === 'checkbox') input.checked = Boolean(saved.checked);
  }
  // Allocation inputs are created from the restored furniture IDs, then populated.
  calculate();
  for (const saved of data.fields.filter(field => field.id.startsWith('order-allocation-'))) {
    const input = document.getElementById(saved.id);
    if (input) input.value = String(saved.value || '');
  }
  for (const card of document.querySelectorAll('.quote-item')) {
    for (const input of card.querySelectorAll('[data-item-agreement], [data-item-fulfillment]')) input.dispatchEvent(new window.Event('change'));
    if ([...card.querySelectorAll('details [data-field]')].some(input => input.value)) card.querySelector('details').open = true;
  }
  for (const [id, photos] of Array.isArray(data.photos) ? data.photos : []) {
    if (!data.itemIds.includes(id) || !Array.isArray(photos)) continue;
    state.photos.set(id, photos.filter(photo => /^data:image\/(?:png|jpeg|webp|gif);base64,/.test(photo.dataUrl || '')));
    renderPhotos(id);
  }
  if (data.branch && allowedBranches().includes(data.branch)) await selectBranch(data.branch);
  calculate();
}

guardStandalonePage({
  permission: COMMERCIAL_DOCUMENT.permission,
  async render({ session }) {
    state.session = session;
    const app = document.getElementById('quote-app');
    if (app) app.hidden = false;
    const back = document.querySelector('.quote-header a');
    if (back) back.href = withPreview('/index.html');
    renderBranchAvailability();
    bindGlobalInteractions();
    addItem();
    if (COMMERCIAL_DOCUMENT.isOrder) state.payments = bindOrderEntry(() => { calculate(); state.draft?.changed(); });
    // QA preview stays ephemeral; real sessions recover only their own tab draft.
    if (!APP_CONFIG.preview.enabled) {
      state.draft = bindFormDraft({ session, type: COMMERCIAL_DOCUMENT.isOrder ? 'order' : 'quote', capture: captureDraft, restore: restoreDraft });
      await state.draft?.ready;
    }
  }
});
