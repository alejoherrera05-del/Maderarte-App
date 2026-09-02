import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { date, escapeHtml, humanizeCode, money, statusTone } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardStandalonePage } from '../core/page-guard.js';

const state = { items: [] };

function requestData(payload) {
  return previewApiData('ORDENES_LISTAR') || apiRequest('ORDENES_LISTAR', payload);
}

function orderUrl(number) {
  return withPreview(`/orden.html?op=${encodeURIComponent(number || '')}`);
}

function statusChip(value) {
  return `<span class="sales-status ${escapeHtml(statusTone(value))}">${escapeHtml(humanizeCode(value))}</span>`;
}

function loadingMarkup() {
  return `<div class="sales-state"><div class="sales-state-inner"><div class="sales-spinner"></div><strong>Consultando ventas</strong><span>Estamos organizando las órdenes disponibles.</span></div></div>`;
}

function emptyMarkup() {
  return `<div class="sales-state"><div class="sales-state-inner"><strong>Todavía no hay órdenes</strong><span>Las ventas registradas en Maderarte aparecerán aquí.</span></div></div>`;
}

function errorMarkup(message) {
  return `<div class="sales-state"><div class="sales-state-inner"><strong>No fue posible cargar el historial</strong><span>${escapeHtml(message || 'Inténtalo nuevamente.')}</span></div></div>`;
}

function renderRows(items) {
  return items.map(item => `<tr data-order-href="${escapeHtml(orderUrl(item.number))}" tabindex="0" aria-label="Abrir orden ${escapeHtml(item.number || '')}">
    <td class="sales-op">${escapeHtml(item.number || '—')}</td>
    <td>${escapeHtml(date(item.date))}</td>
    <td class="sales-client"><strong>${escapeHtml(item.client || 'Sin cliente')}</strong><span>${escapeHtml(item.document || 'Sin identificación')}</span></td>
    <td>${escapeHtml(item.branch || '—')}</td>
    <td class="sales-money">${escapeHtml(money(item.total))}</td>
    <td class="sales-money">${escapeHtml(money(item.paid))}</td>
    <td class="sales-money balance">${escapeHtml(money(item.balance))}</td>
    <td>${statusChip(item.status)}</td>
    <td>${statusChip(item.productionStatus)}</td>
    <td>${escapeHtml(date(item.deliveryDate))}</td>
  </tr>`).join('');
}

function renderMobile(items) {
  return items.map(item => `<a class="sales-mobile-card" href="${escapeHtml(orderUrl(item.number))}">
    <span class="sales-mobile-top"><strong>${escapeHtml(item.number || '—')}</strong>${statusChip(item.status)}</span>
    <span class="sales-mobile-client">${escapeHtml(item.client || 'Sin cliente')}</span>
    <span class="sales-mobile-meta"><span>${escapeHtml(item.branch || '—')} · ${escapeHtml(date(item.date))}</span><strong>${escapeHtml(money(item.balance))} pendiente</strong></span>
  </a>`).join('');
}

function bindRows() {
  document.querySelectorAll('[data-order-href]').forEach(row => {
    const open = () => window.location.assign(row.dataset.orderHref);
    row.addEventListener('click', open);
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function updateSummary(items) {
  const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const paid = items.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const balance = items.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  document.getElementById('sales-summary-count').textContent = String(items.length);
  document.getElementById('sales-summary-total').textContent = money(total);
  document.getElementById('sales-summary-paid').textContent = money(paid);
  document.getElementById('sales-summary-balance').textContent = money(balance);
}

function updateList(items) {
  const result = document.getElementById('sales-results');
  const count = document.getElementById('sales-count');
  count.textContent = `${items.length} ${items.length === 1 ? 'orden' : 'órdenes'}`;
  updateSummary(items);
  if (!items.length) {
    result.innerHTML = emptyMarkup();
    return;
  }
  result.innerHTML = `<div class="sales-table-wrap"><table class="sales-table"><thead><tr><th>OP</th><th>Fecha</th><th>Cliente</th><th>Sede</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Estado</th><th>Producción</th><th>Entrega</th></tr></thead><tbody>${renderRows(items)}</tbody></table></div><div class="sales-mobile-list">${renderMobile(items)}</div>`;
  bindRows();
}

async function loadOrders() {
  const result = document.getElementById('sales-results');
  const refresh = document.getElementById('sales-refresh');
  result.innerHTML = loadingMarkup();
  refresh.disabled = true;
  const payload = {
    query: document.getElementById('sales-search').value.trim(),
    branch: document.getElementById('sales-branch').value,
    status: document.getElementById('sales-status').value,
    productionStatus: document.getElementById('sales-production').value,
    limit: 100
  };
  try {
    const response = await requestData(payload);
    state.items = Array.isArray(response.data?.items) ? response.data.items : [];
    updateList(state.items);
  } catch (error) {
    state.items = [];
    updateSummary([]);
    document.getElementById('sales-count').textContent = 'Sin datos';
    result.innerHTML = errorMarkup(error.message);
  } finally {
    refresh.disabled = false;
  }
}

function renderShell(root) {
  root.innerHTML = `<header class="sales-header">
    <div class="sales-header-inner">
      <a class="sales-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Volver al inicio"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a>
      <div class="sales-brand"><img src="/assets/brand/maderarte-logo-2026.webp" alt="" aria-hidden="true"><div class="sales-brand-copy"><strong>Historial de ventas</strong><span>Órdenes de pedido</span></div></div>
      <button class="sales-round" id="sales-refresh" type="button" aria-label="Actualizar historial"><img src="/assets/icons/arrow-clockwise.svg" alt="" aria-hidden="true"></button>
    </div>
  </header>
  <main class="sales-shell">
    <section class="sales-hero"><div><h1>Historial de ventas</h1><p>Consulta órdenes, pagos, saldos, estado de producción y fecha estimada de entrega.</p></div><span class="sales-readonly">Consulta segura</span></section>
    <section class="sales-summary" aria-label="Resumen del historial">
      <article class="sales-summary-card"><span class="sales-summary-label">Órdenes</span><strong class="sales-summary-value" id="sales-summary-count">0</strong><span class="sales-summary-note">Resultado actual</span></article>
      <article class="sales-summary-card"><span class="sales-summary-label">Valor total</span><strong class="sales-summary-value" id="sales-summary-total">$0</strong><span class="sales-summary-note">Ventas consultadas</span></article>
      <article class="sales-summary-card"><span class="sales-summary-label">Abonado</span><strong class="sales-summary-value" id="sales-summary-paid">$0</strong><span class="sales-summary-note">Pagos registrados</span></article>
      <article class="sales-summary-card"><span class="sales-summary-label">Saldo pendiente</span><strong class="sales-summary-value" id="sales-summary-balance">$0</strong><span class="sales-summary-note">Por recaudar</span></article>
    </section>
    <form class="sales-filters" id="sales-filter-form">
      <div class="sales-filters-grid">
        <div class="sales-field search"><label for="sales-search">Buscar</label><input class="sales-control" id="sales-search" type="search" placeholder="OP, cliente, identificación o teléfono" autocomplete="off"></div>
        <div class="sales-field"><label for="sales-branch">Sede</label><select class="sales-control" id="sales-branch"><option value="">Todas</option><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div>
        <div class="sales-field"><label for="sales-status">Estado</label><select class="sales-control" id="sales-status"><option value="">Todos</option><option value="CONFIRMADA">Confirmada</option><option value="EN_PROCESO">En proceso</option><option value="COMPLETADA">Completada</option><option value="ANULADA">Anulada</option></select></div>
        <div class="sales-field"><label for="sales-production">Producción</label><select class="sales-control" id="sales-production"><option value="">Todas</option><option value="PENDIENTE">Pendiente</option><option value="EN_PROCESO">En proceso</option><option value="LISTA">Lista</option><option value="COMPLETADA">Completada</option></select></div>
        <button class="sales-filter-button" type="submit">Aplicar</button>
      </div>
    </form>
    <section class="sales-sheet"><div class="sales-sheet-toolbar"><span class="sales-sheet-title">Órdenes de pedido</span><span class="sales-count" id="sales-count">0 órdenes</span></div><div id="sales-results">${loadingMarkup()}</div></section>
  </main>`;
}

guardStandalonePage({
  permission: 'ordenes.read',
  async render() {
    const root = document.getElementById('sales-app');
    renderShell(root);
    root.hidden = false;
    document.getElementById('sales-filter-form').addEventListener('submit', event => {
      event.preventDefault();
      loadOrders();
    });
    document.getElementById('sales-refresh').addEventListener('click', loadOrders);
    await loadOrders();
  }
});
