import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { date, escapeHtml, money, statusTone, humanizeCode } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardPage } from '../core/page-guard.js';
import { emptyState, errorState, loadingState, statusBadge } from '../core/ui.js';

const state = { items: [] };

function requestData(payload) {
  return previewApiData('ORDENES_LISTAR') || apiRequest('ORDENES_LISTAR', payload);
}

function orderUrl(number) {
  return withPreview(`/orden.html?op=${encodeURIComponent(number || '')}`);
}

function renderRows(items) {
  return items.map(item => `<tr>
    <td class="primary-cell"><a class="link-action" href="${escapeHtml(orderUrl(item.number))}">${escapeHtml(item.number || '—')}</a></td>
    <td>${escapeHtml(date(item.date))}</td>
    <td>${escapeHtml(item.client || '—')}</td>
    <td>${escapeHtml(item.branch || '—')}</td>
    <td class="money">${escapeHtml(money(item.total))}</td>
    <td class="money">${escapeHtml(money(item.paid))}</td>
    <td class="money">${escapeHtml(money(item.balance))}</td>
    <td>${statusBadge(item.status)}</td>
    <td>${statusBadge(item.productionStatus)}</td>
    <td>${escapeHtml(date(item.deliveryDate))}</td>
  </tr>`).join('');
}

function renderCards(items) {
  return items.map(item => `<a class="order-card" href="${escapeHtml(orderUrl(item.number))}">
    <span class="order-card-top"><strong>${escapeHtml(item.number || '—')}</strong><span class="status-badge ${statusTone(item.status)}">${escapeHtml(humanizeCode(item.status))}</span></span>
    <span class="order-card-client">${escapeHtml(item.client || 'Sin cliente')}</span>
    <span class="order-card-meta"><span>${escapeHtml(item.branch || '—')} · ${escapeHtml(date(item.date))}</span><strong>${escapeHtml(money(item.balance))} pendiente</strong></span>
  </a>`).join('');
}

function updateList(items) {
  const result = document.getElementById('orders-result');
  const count = document.getElementById('orders-count');
  count.textContent = `${items.length} ${items.length === 1 ? 'orden' : 'órdenes'}`;
  if (!items.length) {
    result.innerHTML = emptyState({ icon: 'OP', title: 'Todavía no hay órdenes', message: 'Las órdenes creadas en Maderarte App aparecerán aquí.' });
    return;
  }
  result.innerHTML = `<div class="desktop-only table-wrap"><table class="data-table"><thead><tr><th>OP</th><th>Fecha</th><th>Cliente</th><th>Sede</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Estado</th><th>Producción</th><th>Entrega</th></tr></thead><tbody>${renderRows(items)}</tbody></table></div><div class="mobile-only order-card-list">${renderCards(items)}</div>`;
}

async function searchOrders() {
  const result = document.getElementById('orders-result');
  const payload = {
    query: document.getElementById('order-search').value.trim(),
    branch: document.getElementById('order-branch').value,
    status: document.getElementById('order-status').value,
    productionStatus: document.getElementById('production-status').value,
    limit: 100
  };
  result.innerHTML = loadingState('Consultando órdenes');
  try {
    const response = await requestData(payload);
    state.items = Array.isArray(response.data?.items) ? response.data.items : [];
    updateList(state.items);
  } catch (error) {
    result.innerHTML = errorState(error.message, error.requestId);
  }
}

guardPage({
  permission: 'ordenes.read',
  activeKey: 'ordenes',
  title: 'Órdenes de pedido',
  subtitle: 'Expedientes comerciales de Maderarte.',
  async render({ content }) {
    content.innerHTML = `<section class="page">
      <div class="page-header"><div class="page-heading"><h1>Órdenes de pedido</h1><p>Consulta por número, cliente, identificación, teléfono, sede o estado.</p></div><div class="page-actions"><span class="status-badge info" id="orders-count">0 órdenes</span></div></div>
      <form class="workspace-toolbar" id="orders-filter"><div class="field"><label for="order-search">Buscar</label><input id="order-search" type="search" placeholder="OP, cliente, identificación o teléfono" autocomplete="off"></div><div class="field"><label for="order-branch">Sede</label><select id="order-branch"><option value="">Todas</option><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div><div class="field"><label for="order-status">Estado</label><select id="order-status"><option value="">Todos</option><option value="CONFIRMADA">Confirmada</option><option value="EN_PROCESO">En proceso</option><option value="COMPLETADA">Completada</option><option value="ANULADA">Anulada</option></select></div><div class="field"><label for="production-status">Producción</label><select id="production-status"><option value="">Todas</option><option value="PENDIENTE">Pendiente</option><option value="EN_PROCESO">En proceso</option><option value="LISTA">Lista</option><option value="COMPLETADA">Completada</option></select></div><button class="button secondary" type="submit">Buscar</button></form>
      <div id="orders-result">${loadingState('Consultando órdenes')}</div>
    </section>`;
    document.getElementById('orders-filter').addEventListener('submit', event => { event.preventDefault(); searchOrders(); });
    await searchOrders();
  }
});
