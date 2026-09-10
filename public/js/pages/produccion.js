import { createOrderFlow, orderReturnPath } from '../core/order-flow-context.js';
import { bindSupplierDirectory } from '../core/supplier-directory.js';
import { createEntrance } from '../core/maddy-entrance.js?v=1';
import { apiRequest } from '../core/api.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { hasPermission } from '../core/permissions.js';
import { escapeHtml as esc } from '../core/format.js';
import { sandboxLink, bindSandboxBanner } from '../core/order-sandbox-context.js';
import { buildProductionRequest, productionEligibility, supplierWhatsAppUrl } from '../core/production-request.js';
const $ = id => document.getElementById('production-' + id);
const flow = createOrderFlow({cover:$('cover'),workflow:$('workflow'),label:'Producción'});
let account = null, sequence = 0, entrance;
function invalidate() { $('preview').hidden = true; $('message').value = ''; $('whatsapp').removeAttribute('href'); $('copy-status').textContent = ''; }
function selection() { return [...$('items').children].filter(row => row.querySelector('[type=checkbox]').checked).map(row => ({ id: row.dataset.id, quantity: Number(row.querySelector('[type=number]').value) })); }
function updateSelection() {
  invalidate();
  const selected = new Set(selection().map(item => item.id));
  $('selection-summary').textContent = selected.size ? `${selected.size} ${selected.size===1?'mueble seleccionado':'muebles seleccionados'}` : 'Selecciona los que vas a solicitar.';
  const separated = account.items.some(item => selected.has(item.id) && item.agreement === 'SEPARADO');
  $('notice-wrap').hidden = $('notice-help').hidden = !separated;
  $('notice').required = separated;
  if (!separated) $('notice').checked = false;
}
function showAccount(data) {
  if (!data?.order || !Array.isArray(data.items)) throw new Error('No encontramos esta orden.');
  account = data; $('form').reset(); invalidate();
  $('number').textContent = data.order.number;
  $('client').textContent = data.order.client;
  $('dossier').href = orderReturnPath(data.order.number);
  $('items').replaceChildren();
  data.items.forEach((item, index) => {
    const issue = productionEligibility(data.order, item), row = document.createElement('div');
    row.className = 'production-item' + (issue ? ' is-blocked' : ''); row.dataset.id = item.id;
    const detail = [item.fabricColor && 'Tela: ' + item.fabricColor, item.woodColor && 'Madera: ' + item.woodColor, item.measures, item.specifications].filter(Boolean).join(' · ');
    row.innerHTML = `<input type="checkbox" id="production-select-${index}" ${issue ? 'disabled' : ''}><label for="production-select-${index}">${esc(item.description)}<small>${esc(issue || `${item.pending} ${item.pending===1?'pendiente':'pendientes'}${item.agreement === 'SEPARADO' ? ' · Separado' : ''}`)}</small>${detail ? `<small>${esc(detail)}</small>` : ''}</label><label class="production-quantity" for="production-qty-${index}">Cantidad<input id="production-qty-${index}" type="number" min="1" max="${Number.isSafeInteger(item.pending) ? item.pending : 0}" step="1" inputmode="numeric" disabled></label>`;
    const check = row.querySelector('[type=checkbox]'), quantity = row.querySelector('[type=number]');
    check.addEventListener('change', () => { quantity.disabled = !check.checked; quantity.required = check.checked; quantity.value = check.checked ? '1' : ''; updateSelection(); });
    $('items').append(row);
  });
  if (!data.items.length) $('items').textContent = 'Esta orden no tiene muebles para consultar.';
  updateSelection(); $('workspace').hidden = false; flow.ready(); entrance.open();
  $('feedback').textContent = data.items.some(item => !productionEligibility(data.order, item)) ? '' : 'No hay muebles habilitados para preparar una solicitud en esta OP.';
  $('prepare').disabled = !data.items.some(item => !productionEligibility(data.order, item));
}
async function openOrder(number, expected = ++sequence) {
  $('search-status').textContent = 'Consultando la OP…';
  try {
    const response = await apiRequest('ORDEN_OBTENER', { number });
    if (expected !== sequence) return;
    showAccount(response.data); $('search-status').textContent = '';
  } catch (error) { if (expected === sequence) { $('search-status').textContent = error.message; flow.fail(error.message); } }
}
async function search(event) {
  event.preventDefault();
  const query = $('query').value.trim(), expected = ++sequence;
  $('results').replaceChildren(); if (!query) return;
  if (/^(MP|TP)-[A-Z0-9-]+-\d+$/i.test(query)) return openOrder(query.toUpperCase(), expected);
  $('search-status').textContent = 'Buscando órdenes…';
  try {
    const response = await apiRequest('ORDENES_LISTAR', { query, limit: 50 });
    if (expected !== sequence) return;
    const items = response.data?.items || [];
    $('search-status').textContent = items.length ? `${items.length} órdenes encontradas.${response.data.total > items.length ? ' Afina la búsqueda para ver más.' : ''}` : 'No encontramos órdenes con esa búsqueda.';
    for (const order of items) {
      const button = document.createElement('button'); button.type = 'button';
      button.innerHTML = `<span>${esc(order.client)}<small>${esc(order.description)}</small></span><strong>${esc(order.number)}</strong>`;
      button.addEventListener('click', () => void openOrder(order.number)); $('results').append(button);
    }
  } catch (error) { if (expected === sequence) $('search-status').textContent = error.message + ' Vuelve a pulsar Buscar.'; }
}
guardStandalonePage({ permission: 'ordenes.read', async render({ session }) {
  if (!hasPermission(session, 'produccion.read')) { $('app').hidden = false; $('app').textContent = 'No tienes permiso para consultar Producción.'; return; }
  $('app').hidden = false; bindSandboxBanner($('app')); flow.sync();
  const supplierContacts = bindSupplierDirectory({uid:session.profile.uid,root:document.getElementById('supplier-directory'),name:$('supplier'),phone:$('phone'),onSelect:invalidate});
  $('search-form').addEventListener('submit', event => void search(event));
  $('query').addEventListener('input', () => { sequence++; $('results').replaceChildren(); $('search-status').textContent = ''; });
  entrance = createEntrance({ cover: $('cover'), workflow: $('workflow'), input: $('query'), newSearch: $('new-search'), onReturn() { flow.clear(); sequence++; account = null; invalidate(); $('workspace').hidden = true; } });
  $('form').addEventListener('input', invalidate);
  $('form').addEventListener('change', invalidate);
  $('form').addEventListener('submit', event => {
    event.preventDefault(); invalidate(); $('feedback').textContent = '';
    try {
      const message = buildProductionRequest({ ...account, selected: selection(), supplier: $('supplier').value, notes: $('notes').value, customerNotice: $('notice').checked, priorReview: $('reviewed').checked });
      $('whatsapp').href = supplierWhatsAppUrl($('phone').value, message);
      $('message').value = message; $('preview').hidden = false; supplierContacts?.remember();
      $('preview-title').focus(); $('preview').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) { $('feedback').textContent = error.message; }
  });
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('message').value); $('copy-status').textContent = 'Mensaje copiado.'; }
    catch { $('message').focus(); $('message').select(); $('copy-status').textContent = 'Seleccioné el texto. Usa Copiar en tu dispositivo.'; }
  });
  const number = new URL(window.location.href).searchParams.get('op');
  if (number) await openOrder(number);
} });
