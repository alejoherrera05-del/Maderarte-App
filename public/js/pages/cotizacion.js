import { apiRequest } from '../core/api.js';
import { APP_CONFIG } from '../core/config.js';
import { previewApiData } from '../core/auth.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { escapeHtml } from '../core/format.js';
import { bindClientLookup } from '../core/client-lookup.js';
import { COMMERCIAL_RULES, manufacturingWindowLabel, minimumOrderDeposit, remainingAfterMinimumDeposit } from '../core/commercial-rules.js';

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
  return moneyFormatter.format(Number.isFinite(number) ? number : 0);
}

function parseMoney(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return Number(digits || 0);
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
  return {
    ...base,
    branchAddress: '',
    branchPhone: '',
    previewNumber: '',
    numberStatus: 'PENDIENTE',
    issuedAt: new Date().toISOString(),
    advisor: state.session?.profile?.name || '',
    company: {
      legalName: 'MADERARTE POPAYÁN S.A.S.',
      nit: '',
      website: 'maderartepopayan.com'
    }
  };
}

async function requestQuoteMeta(branch) {
  if (APP_CONFIG.preview.enabled) return fallbackQuoteMeta(branch);
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
  const number = meta.previewNumber || 'Pendiente de asignar';
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
  if (!code) return;
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
  setGateMessage(state.quoteMeta ? 'Selecciona la sede que debe quedar asociada a esta propuesta.' : '');
}

function itemMarkup(id) {
  return `<article class="quote-item" data-item-id="${id}">
    <div class="quote-item-head">
      <div class="quote-item-index"><span data-item-position>01</span><div><strong>Mueble</strong><small>Detalle comercial y técnico</small></div></div>
      <button class="quote-remove-item" type="button" data-remove-item>Eliminar</button>
    </div>
    <div class="quote-item-grid">
      <div class="quote-field quote-item-description"><label for="quote-item-${id}-description">Descripción</label><input id="quote-item-${id}-description" data-field="description" placeholder="Ej. Sofá Oslo 2.10 m en bouclé"></div>
      <div class="quote-field quote-item-category"><label for="quote-item-${id}-category">Categoría</label><select id="quote-item-${id}-category" data-field="category"><option value="">Seleccionar</option><option value="SALA">Sala</option><option value="COMEDOR">Comedor</option><option value="ALCOBA">Alcoba</option><option value="INFANTIL">Infantil</option><option value="OFICINA">Oficina</option><option value="COMPLEMENTO">Complemento</option><option value="OTRO">Otro</option></select></div>
      <div class="quote-field quote-item-quantity"><label for="quote-item-${id}-quantity">Cantidad</label><input id="quote-item-${id}-quantity" data-field="quantity" type="number" min="1" step="1" value="1" inputmode="numeric"></div>
      <div class="quote-field quote-item-value"><label for="quote-item-${id}-unitValue">Valor unitario</label><input id="quote-item-${id}-unitValue" data-field="unitValue" inputmode="numeric" placeholder="$ 0"></div>
      <div class="quote-field quote-item-fabric"><label for="quote-item-${id}-fabric">Tela / acabado</label><input id="quote-item-${id}-fabric" data-field="fabric" placeholder="Tela, tono, textura o acabado"></div>
      <div class="quote-field quote-item-wood"><label for="quote-item-${id}-wood">Madera / acabado</label><input id="quote-item-${id}-wood" data-field="wood" placeholder="Madera, pintura, tono o acabado"></div>
      <div class="quote-field quote-item-specifications"><label for="quote-item-${id}-specifications">Especificaciones</label><textarea id="quote-item-${id}-specifications" data-field="specifications" rows="4" placeholder="Medidas, distribución, espuma, herrajes, detalles de diseño, cambios especiales…"></textarea></div>
      <div class="quote-item-line-total"><span>Total del mueble</span><strong data-line-total>$ 0</strong></div>
    </div>
    <div class="quote-photo-area">
      <div class="quote-photo-head"><div><strong>Referencias visuales</strong><span>Fotos, bocetos o inspiración que deben acompañar este mueble.</span></div><small>Se enviarán al anexo fotográfico.</small></div>
      <button class="quote-photo-drop" type="button" data-add-photos><span class="quote-photo-plus">＋</span><span><strong>Agregar fotografías</strong><small>Puedes seleccionar varias imágenes.</small></span></button>
      <input class="quote-photo-input" data-photo-input type="file" accept="image/*" multiple>
      <div class="quote-photo-list" data-photo-list></div>
    </div>
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
  if (count) count.textContent = `${cards.length} ${cards.length === 1 ? 'item' : 'items'}`;
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
}

function bindItem(card) {
  const itemId = Number(card.dataset.itemId);
  card.querySelector('[data-remove-item]')?.addEventListener('click', () => {
    if (document.querySelectorAll('.quote-item').length <= 1) return;
    state.photos.delete(itemId);
    card.remove();
    renumberItems();
    calculate();
  });

  card.querySelectorAll('[data-field="quantity"], [data-field="unitValue"]').forEach(input => {
    input.addEventListener('input', calculate);
  });

  const unitValue = card.querySelector('[data-field="unitValue"]');
  unitValue?.addEventListener('blur', () => {
    const value = parseMoney(unitValue.value);
    unitValue.value = value ? money(value) : '';
  });
  unitValue?.addEventListener('focus', () => {
    const value = parseMoney(unitValue.value);
    unitValue.value = value ? String(value) : '';
  });

  const photoInput = card.querySelector('[data-photo-input]');
  card.querySelector('[data-add-photos]')?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async () => {
    await addPhotos(itemId, photoInput.files);
    photoInput.value = '';
  });
}

function addItem() {
  const root = document.getElementById('quote-items');
  if (!root) return;
  const id = state.nextItemId++;
  root.insertAdjacentHTML('beforeend', itemMarkup(id));
  state.photos.set(id, []);
  const card = root.querySelector(`.quote-item[data-item-id="${id}"]`);
  if (card) bindItem(card);
  renumberItems();
  calculate();
}

function itemData(card, index) {
  const field = name => card.querySelector(`[data-field="${name}"]`)?.value?.trim() || '';
  const quantity = Math.max(0, Number(field('quantity') || 0));
  const unitValue = parseMoney(field('unitValue'));
  const itemId = Number(card.dataset.itemId);
  return {
    position: index + 1,
    itemId,
    description: field('description'),
    category: field('category'),
    quantity,
    fabric: field('fabric'),
    wood: field('wood'),
    specifications: field('specifications'),
    unitValue,
    subtotal: quantity * unitValue,
    photos: state.photos.get(itemId) || []
  };
}

function collectData() {
  const items = Array.from(document.querySelectorAll('.quote-item')).map(itemData);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Math.min(subtotal, parseMoney(document.getElementById('quote-discount')?.value));
  const total = Math.max(0, subtotal - discount);
  return {
    meta: state.quoteMeta || fallbackQuoteMeta(''),
    client: {
      document: document.getElementById('quote-client-document')?.value.trim() || '',
      name: document.getElementById('quote-client-name')?.value.trim() || '',
      phone: document.getElementById('quote-client-phone')?.value.trim() || '',
      email: document.getElementById('quote-client-email')?.value.trim() || '',
      address: document.getElementById('quote-client-address')?.value.trim() || '',
      city: document.getElementById('quote-client-city')?.value.trim() || ''
    },
    notes: document.getElementById('quote-notes')?.value.trim() || '',
    items,
    subtotal,
    discount,
    total,
    minimumDeposit: minimumOrderDeposit(total),
    remaining: remainingAfterMinimumDeposit(total)
  };
}

function calculate() {
  const cards = Array.from(document.querySelectorAll('.quote-item'));
  let subtotal = 0;
  cards.forEach((card, index) => {
    const item = itemData(card, index);
    subtotal += item.subtotal;
    const line = card.querySelector('[data-line-total]');
    if (line) line.textContent = money(item.subtotal);
  });
  const discountInput = document.getElementById('quote-discount');
  const discount = Math.min(subtotal, parseMoney(discountInput?.value));
  const total = Math.max(0, subtotal - discount);
  document.getElementById('quote-subtotal').textContent = money(subtotal);
  document.getElementById('quote-total').textContent = money(total);
  document.getElementById('quote-minimum-deposit').textContent = money(minimumOrderDeposit(total));
  document.getElementById('quote-remaining').textContent = money(remainingAfterMinimumDeposit(total));
}

function previewItemMarkup(item) {
  const details = [item.category, item.fabric, item.wood, item.specifications].filter(Boolean).join(' · ');
  return `<div class="quote-preview-item"><div class="quote-preview-item-copy"><strong>${escapeHtml(item.position + '. ' + (item.description || 'Mueble sin descripción'))}</strong><span>${escapeHtml(details || 'Sin especificaciones adicionales')}</span></div><div class="quote-preview-item-amount"><strong>${escapeHtml(money(item.subtotal))}</strong><span>${escapeHtml(`${item.quantity || 0} × ${money(item.unitValue)}`)}</span></div></div>`;
}

function companyInfoMarkup(meta) {
  const company = meta.company || {};
  const details = [meta.branchAddress, meta.branchPhone, company.website].filter(Boolean);
  return `<div class="quote-preview-company"><div><strong>${escapeHtml(company.legalName || 'MADERARTE POPAYÁN S.A.S.')}</strong>${company.nit ? `<span>NIT ${escapeHtml(company.nit)}</span>` : ''}</div><div class="quote-preview-company-details"><span>${escapeHtml(meta.branchName || meta.branch || 'Sede Maderarte')}</span>${details.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div></div>`;
}

function appendixMarkup(data) {
  const withPhotos = data.items.filter(item => item.photos.length);
  const meta = data.meta;
  if (!withPhotos.length) {
    return `<section class="quote-preview-page quote-preview-appendix-page"><div class="quote-preview-annex-head"><div><span>Anexo fotográfico</span><h3>Referencias por mueble</h3></div><strong>${escapeHtml(meta.previewNumber || 'Borrador')}</strong></div><div class="quote-preview-empty-appendix">No se agregaron fotografías a esta propuesta.</div></section>`;
  }
  return `<section class="quote-preview-page quote-preview-appendix-page"><div class="quote-preview-annex-head"><div><span>Anexo fotográfico</span><h3>Referencias por mueble</h3></div><strong>${escapeHtml(meta.previewNumber || 'Borrador')}</strong></div>${withPhotos.map(item => {
    const details = [item.category, item.fabric, item.wood, item.specifications].filter(Boolean).join(' · ');
    return `<article class="quote-appendix-item"><div class="quote-appendix-item-head"><div><span>Item ${item.position}</span><strong>${escapeHtml(item.description || 'Mueble sin descripción')}</strong></div><p>${escapeHtml(details || 'Sin especificaciones adicionales')}</p></div><div class="quote-appendix-photos">${item.photos.map((photo, index) => `<figure><img src="${escapeHtml(photo.dataUrl)}" alt="Referencia ${index + 1} del item ${item.position}"><figcaption>Referencia ${index + 1}</figcaption></figure>`).join('')}</div></article>`;
  }).join('')}</section>`;
}

function renderPreview() {
  const data = collectData();
  const meta = data.meta;
  const clientLocation = [data.client.address, data.client.city].filter(Boolean).join(' · ');
  const number = meta.previewNumber || 'Pendiente de asignar';
  const mainPage = `<section class="quote-preview-page quote-preview-main-page">
    <div class="quote-preview-letterhead"><div class="quote-preview-logo-lockup"><img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte"><div><img src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"><span>Muebles con un estilo diferente para cada cliente</span></div></div><div class="quote-preview-doc-id"><span>COTIZACIÓN</span><strong>${escapeHtml(number)}</strong><small>${escapeHtml(formatDate(meta.issuedAt))}</small></div></div>
    ${companyInfoMarkup(meta)}
    <div class="quote-preview-context"><span><small>Sede emisora</small><strong>${escapeHtml(meta.branchName || meta.branch || '—')}</strong></span><span><small>Asesor</small><strong>${escapeHtml(meta.advisor || state.session?.profile?.name || '—')}</strong></span><span><small>Estado</small><strong>Borrador</strong></span></div>
    <div class="quote-preview-client-title"><span>Cliente</span><h3>${escapeHtml(data.client.name || 'Cliente por definir')}</h3></div>
    <div class="quote-preview-client"><span>Identificación<strong>${escapeHtml(data.client.document || '—')}</strong></span><span>Teléfono<strong>${escapeHtml(data.client.phone || '—')}</strong></span><span>Correo<strong>${escapeHtml(data.client.email || '—')}</strong></span><span>Dirección<strong>${escapeHtml(clientLocation || '—')}</strong></span></div>
    <div class="quote-preview-items-head"><span>Detalle</span><strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong></div>
    <div class="quote-preview-items">${data.items.map(previewItemMarkup).join('')}</div>
    <div class="quote-preview-bottom"><div class="quote-preview-terms"><strong>Condiciones comerciales</strong><p>• Abono mínimo para solicitar e iniciar el pedido: ${COMMERCIAL_RULES.minimumOrderDepositPercent}% del valor total (${escapeHtml(money(data.minimumDeposit))} con el valor actual).</p><p>• Tiempo estimado de fabricación: ${escapeHtml(manufacturingWindowLabel())}, contado desde la confirmación del pedido y el abono mínimo requerido.</p>${data.notes ? `<p><b>Observaciones:</b> ${escapeHtml(data.notes)}</p>` : ''}</div><div class="quote-preview-finance"><div><span>Subtotal</span><strong>${escapeHtml(money(data.subtotal))}</strong></div><div><span>Descuento</span><strong>− ${escapeHtml(money(data.discount))}</strong></div><div><span>Total</span><strong>${escapeHtml(money(data.total))}</strong></div></div></div>
    <footer class="quote-preview-footer"><span>${escapeHtml(meta.company?.website || 'maderartepopayan.com')}</span><span>Documento borrador · sin validez comercial</span></footer>
  </section>`;
  document.getElementById('quote-preview-content').innerHTML = mainPage + appendixMarkup(data);
}

function openPreview() {
  if (!state.quoteMeta) {
    openBranchGate();
    return;
  }
  renderPreview();
  const overlay = document.getElementById('quote-preview-overlay');
  overlay?.classList.add('is-open');
  overlay?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => document.getElementById('quote-preview-close')?.focus(), 180);
}

function closePreview() {
  const overlay = document.getElementById('quote-preview-overlay');
  overlay?.classList.remove('is-open');
  overlay?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function bindGlobalInteractions() {
  document.querySelectorAll('[data-quote-branch]').forEach(button => {
    button.addEventListener('click', () => selectBranch(button.dataset.quoteBranch));
  });
  document.getElementById('quote-change-branch')?.addEventListener('click', openBranchGate);
  document.getElementById('quote-add-item')?.addEventListener('click', addItem);
  document.getElementById('quote-preview-button')?.addEventListener('click', openPreview);
  document.getElementById('quote-summary-preview')?.addEventListener('click', openPreview);
  document.getElementById('quote-preview-close')?.addEventListener('click', closePreview);
  document.getElementById('quote-preview-overlay')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closePreview();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('quote-preview-overlay')?.classList.contains('is-open')) closePreview();
  });

  const discount = document.getElementById('quote-discount');
  discount?.addEventListener('input', calculate);
  discount?.addEventListener('blur', () => {
    const value = parseMoney(discount.value);
    discount.value = value ? money(value) : '';
    calculate();
  });
  discount?.addEventListener('focus', () => {
    const value = parseMoney(discount.value);
    discount.value = value ? String(value) : '';
  });

  bindClientLookup({
    input: document.getElementById('quote-client-document'),
    list: document.getElementById('quote-client-suggestions'),
    message: document.getElementById('quote-client-message'),
    fields: Object.fromEntries(['name', 'phone', 'email', 'address', 'city'].map(key => [key, document.getElementById(`quote-client-${key}`)])),
    async search(query) {
      const response = await requestClients({ query, limit: 8 });
      return response.data?.items || [];
    },
    async load(document) {
      const response = previewApiData('CLIENTE_OBTENER') || await apiRequest('CLIENTE_OBTENER', { document });
      return response.data?.client || null;
    }
  });
  document.getElementById('quote-form')?.addEventListener('submit', event => event.preventDefault());
}

guardStandalonePage({
  permission: 'cotizaciones.read',
  async render({ session }) {
    state.session = session;
    const app = document.getElementById('quote-app');
    if (app) app.hidden = false;
    renderBranchAvailability();
    bindGlobalInteractions();
    addItem();
  }
});
