import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { escapeHtml, initials } from '../core/format.js';
import { COMMERCIAL_RULES, manufacturingWindowLabel, minimumOrderDeposit, remainingAfterMinimumDeposit } from '../core/commercial-rules.js';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const state = {
  session: null,
  nextItemId: 1,
  photos: new Map(),
  suggestionsTimer: 0
};

function money(value) {
  const number = Number(value);
  return moneyFormatter.format(Number.isFinite(number) ? number : 0);
}

function parseMoney(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return Number(digits || 0);
}

function hasPermission(permission) {
  const permissions = Array.isArray(state.session?.permissions) ? state.session.permissions : [];
  const scope = String(permission || '').split('.')[0];
  return permissions.includes('*') || permissions.includes(permission) || permissions.includes(`${scope}.*`);
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

function itemMarkup(id) {
  return `<article class="quote-item" data-item-id="${id}">
    <div class="quote-item-head">
      <div class="quote-item-index"><span data-item-position>01</span><strong>Item</strong></div>
      <button class="quote-remove-item" type="button" data-remove-item>Eliminar</button>
    </div>
    <div class="quote-item-grid">
      <div class="quote-field"><label>Descripción del mueble</label><input data-field="description" placeholder="Ej. Sofá Oslo 2.10 m en bouclé"></div>
      <div class="quote-field"><label>Categoría</label><input data-field="category" placeholder="Ej. Sala, comedor, alcoba"></div>
      <div class="quote-field"><label>Referencia</label><input data-field="reference" placeholder="Modelo o referencia"></div>
      <div class="quote-field"><label>Cantidad</label><input data-field="quantity" type="number" min="1" step="1" value="1" inputmode="numeric"></div>
      <div class="quote-field"><label>Unidad</label><select data-field="unit"><option value="UNIDAD">Unidad</option><option value="JUEGO">Juego</option><option value="METRO">Metro</option></select></div>
      <div class="quote-field"><label>Medidas</label><input data-field="measures" placeholder="Ej. 2.10 × 0.88 m"></div>
      <div class="quote-field"><label>Tela / color</label><input data-field="fabric" placeholder="Tela, tono o acabado"></div>
      <div class="quote-field"><label>Madera / color</label><input data-field="wood" placeholder="Madera, pintura o acabado"></div>
      <div class="quote-field"><label>Especificaciones</label><textarea data-field="specifications" rows="3" placeholder="Detalles de diseño, espuma, herrajes, distribución, cambios especiales…"></textarea></div>
      <div class="quote-field"><label>Valor unitario</label><input data-field="unitValue" inputmode="numeric" placeholder="$ 0"></div>
      <div class="quote-item-line-total">Total del item <strong data-line-total>$ 0</strong></div>
    </div>
    <div class="quote-photo-area">
      <div class="quote-photo-head">
        <div class="quote-photo-copy"><strong>Referencias fotográficas</strong><span>Estas imágenes se organizarán en el anexo fotográfico, separadas por item.</span></div>
        <button class="quote-photo-button" type="button" data-add-photos>＋ Agregar fotos</button>
      </div>
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
  list.innerHTML = photos.map((photo, index) => `<div class="quote-photo-thumb"><img src="${escapeHtml(photo.dataUrl)}" alt="Referencia ${index + 1} del item"><button class="quote-photo-remove" type="button" data-remove-photo="${index}" aria-label="Eliminar fotografía">×</button></div>`).join('');
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
    reference: field('reference'),
    quantity,
    unit: field('unit'),
    measures: field('measures'),
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
    client: {
      document: document.getElementById('quote-client-document')?.value.trim() || '',
      name: document.getElementById('quote-client-name')?.value.trim() || '',
      phone: document.getElementById('quote-client-phone')?.value.trim() || '',
      email: document.getElementById('quote-client-email')?.value.trim() || '',
      address: document.getElementById('quote-client-address')?.value.trim() || '',
      city: document.getElementById('quote-client-city')?.value.trim() || ''
    },
    branch: document.getElementById('quote-branch')?.value || '',
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

function clientOptionMarkup(item) {
  const secondary = [item.document, item.phone, item.city].filter(Boolean).join(' · ') || 'Sin datos adicionales';
  return `<button class="quote-client-option" type="button" role="option" data-client-document="${escapeHtml(item.document)}">
    <span class="quote-client-avatar">${escapeHtml(initials(item.name))}</span>
    <span class="quote-client-option-copy"><strong>${escapeHtml(item.name || 'Sin nombre')}</strong><span>${escapeHtml(secondary)}</span></span>
    <span aria-hidden="true">›</span>
  </button>`;
}

function hideClientSuggestions() {
  const root = document.getElementById('quote-client-suggestions');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}

function setClientMessage(value = '', error = false) {
  const message = document.getElementById('quote-client-message');
  if (!message) return;
  message.textContent = value;
  message.classList.toggle('is-error', Boolean(error));
}

function fillClient(client) {
  document.getElementById('quote-client-document').value = client.document || '';
  document.getElementById('quote-client-name').value = client.name || '';
  document.getElementById('quote-client-phone').value = client.phone || '';
  document.getElementById('quote-client-email').value = client.email || '';
  document.getElementById('quote-client-address').value = client.address || '';
  document.getElementById('quote-client-city').value = client.city || '';
  document.getElementById('quote-client-search').value = client.name || client.document || '';
  hideClientSuggestions();
  setClientMessage('Cliente seleccionado. Puedes ajustar los datos para esta propuesta si es necesario.');
}

async function updateClientSuggestions() {
  const query = document.getElementById('quote-client-search')?.value.trim() || '';
  if (query.length < 2) {
    hideClientSuggestions();
    setClientMessage('');
    return;
  }
  try {
    const response = await requestClients({ query, limit: 8 });
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    const root = document.getElementById('quote-client-suggestions');
    if (!items.length || !root) {
      hideClientSuggestions();
      setClientMessage('No encontramos un cliente existente. Puedes completar los datos manualmente.');
      return;
    }
    root.innerHTML = items.map(clientOptionMarkup).join('');
    root.hidden = false;
    root.querySelectorAll('[data-client-document]').forEach(button => {
      button.addEventListener('click', () => {
        const client = items.find(item => String(item.document) === String(button.dataset.clientDocument));
        if (client) fillClient(client);
      });
    });
    setClientMessage(`${items.length} ${items.length === 1 ? 'coincidencia' : 'coincidencias'}.`);
  } catch (error) {
    hideClientSuggestions();
    setClientMessage(error.message || 'No fue posible consultar clientes.', true);
  }
}

function previewItemMarkup(item) {
  const details = [item.reference, item.measures, item.fabric, item.wood].filter(Boolean).join(' · ');
  return `<div class="quote-preview-item"><div class="quote-preview-item-copy"><strong>${escapeHtml(item.position + '. ' + (item.description || 'Item sin descripción'))}</strong><span>${escapeHtml(details || item.specifications || 'Sin especificaciones adicionales')}</span></div><div class="quote-preview-item-amount"><strong>${escapeHtml(money(item.subtotal))}</strong><span>${escapeHtml(`${item.quantity || 0} ${item.unit || 'UNIDAD'} × ${money(item.unitValue)}`)}</span></div></div>`;
}

function appendixMarkup(items) {
  const withPhotos = items.filter(item => item.photos.length);
  if (!withPhotos.length) return `<section class="quote-preview-page"><div class="quote-appendix-title"><span>ANEXO</span><h3>Referencias fotográficas</h3></div><div class="quote-preview-empty-appendix">Todavía no agregaste fotografías. Cuando existan, se organizarán aquí por item sin recargar la hoja principal.</div></section>`;
  return `<section class="quote-preview-page"><div class="quote-appendix-title"><span>ANEXO FOTOGRÁFICO</span><h3>Referencias por item</h3></div>${withPhotos.map(item => {
    const details = [item.reference, item.measures, item.fabric, item.wood, item.specifications].filter(Boolean).join(' · ');
    return `<article class="quote-appendix-item"><div class="quote-appendix-item-head"><strong>Item ${item.position} · ${escapeHtml(item.description || 'Sin descripción')}</strong><span>${escapeHtml(details || 'Sin especificaciones adicionales')}</span></div><div class="quote-appendix-photos">${item.photos.map((photo, index) => `<img src="${escapeHtml(photo.dataUrl)}" alt="Referencia ${index + 1} del item ${item.position}">`).join('')}</div></article>`;
  }).join('')}</section>`;
}

function renderPreview() {
  const data = collectData();
  const now = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date());
  const clientLocation = [data.client.address, data.client.city].filter(Boolean).join(' · ');
  const mainPage = `<section class="quote-preview-page">
    <div class="quote-preview-brand"><img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte"><div><strong>MADERARTE</strong><span>${escapeHtml(now)} · ${escapeHtml(data.branch || 'Sede sin definir')}</span></div></div>
    <div class="quote-preview-title"><p>COTIZACIÓN · BORRADOR</p><h3>${escapeHtml(data.client.name || 'Cliente por definir')}</h3></div>
    <div class="quote-preview-client">
      <span>Identificación<strong>${escapeHtml(data.client.document || '—')}</strong></span>
      <span>Teléfono<strong>${escapeHtml(data.client.phone || '—')}</strong></span>
      <span>Correo<strong>${escapeHtml(data.client.email || '—')}</strong></span>
      <span>Dirección<strong>${escapeHtml(clientLocation || '—')}</strong></span>
    </div>
    <div class="quote-preview-items">${data.items.map(previewItemMarkup).join('')}</div>
    <div class="quote-preview-finance"><div><span>Subtotal</span><strong>${escapeHtml(money(data.subtotal))}</strong></div><div><span>Descuento</span><strong>− ${escapeHtml(money(data.discount))}</strong></div><div><span>Total</span><strong>${escapeHtml(money(data.total))}</strong></div></div>
    ${data.notes ? `<div class="quote-preview-conditions"><strong>Observaciones</strong><br>${escapeHtml(data.notes)}</div>` : ''}
    <div class="quote-preview-conditions"><strong>Condiciones comerciales</strong><br>• Para solicitar e iniciar el pedido se requiere un abono mínimo del ${COMMERCIAL_RULES.minimumOrderDepositPercent}% (${escapeHtml(money(data.minimumDeposit))} con el valor actual).<br>• Tiempo estimado de fabricación: ${escapeHtml(manufacturingWindowLabel())}, contado desde la confirmación del pedido y el abono mínimo requerido.</div>
  </section>`;
  document.getElementById('quote-preview-content').innerHTML = mainPage + appendixMarkup(data.items);
}

function openPreview() {
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
  document.getElementById('quote-add-item')?.addEventListener('click', addItem);
  document.getElementById('quote-preview-button')?.addEventListener('click', openPreview);
  document.getElementById('quote-summary-preview')?.addEventListener('click', openPreview);
  document.getElementById('quote-preview-close')?.addEventListener('click', closePreview);
  document.getElementById('quote-preview-overlay')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closePreview();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePreview();
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

  const search = document.getElementById('quote-client-search');
  search?.addEventListener('input', () => {
    window.clearTimeout(state.suggestionsTimer);
    state.suggestionsTimer = window.setTimeout(updateClientSuggestions, 220);
  });
  document.addEventListener('click', event => {
    const wrap = document.querySelector('.quote-client-search-wrap');
    if (wrap && !wrap.contains(event.target)) hideClientSuggestions();
  });
  document.getElementById('quote-form')?.addEventListener('submit', event => event.preventDefault());
}

guardStandalonePage({
  permission: 'cotizaciones.read',
  async render({ session }) {
    state.session = session;
    const app = document.getElementById('quote-app');
    if (app) app.hidden = false;
    const branch = document.getElementById('quote-branch');
    if (branch && ['MP', 'TP'].includes(session.profile?.mainBranch)) branch.value = session.profile.mainBranch;
    bindGlobalInteractions();
    addItem();
  }
});
