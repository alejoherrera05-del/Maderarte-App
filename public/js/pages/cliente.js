import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { date, escapeHtml, money, humanizeCode } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardPage } from '../core/page-guard.js';
import { emptyState, errorState, loadingState, statusBadge } from '../core/ui.js';

function clientDocument() {
  return new URLSearchParams(window.location.search).get('id')?.trim() || '';
}

function requestData(document) {
  return previewApiData('CLIENTE_OBTENER') || apiRequest('CLIENTE_OBTENER', { document });
}

function orderUrl(number) {
  return withPreview(`/orden.html?op=${encodeURIComponent(number || '')}`);
}

function detail(label, value) {
  return `<div class="client-detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`;
}

function summaryCard(label, value) {
  return `<div class="client-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderOrders(items) {
  if (!items.length) return `<div class="empty-state"><div class="empty-state-inner"><h2>Sin órdenes todavía</h2><p>Las órdenes de este cliente aparecerán aquí.</p></div></div>`;
  return `<div class="client-activity-list">${items.map(item => `<a class="client-activity-row" href="${escapeHtml(orderUrl(item.number))}"><span class="client-activity-copy"><strong>${escapeHtml(item.number || 'Orden')}</strong><span>${escapeHtml(`${date(item.date)} · ${humanizeCode(item.productionStatus || item.status)}`)}</span></span><span class="client-activity-value">${escapeHtml(money(item.total || 0))}</span></a>`).join('')}</div>`;
}

function renderQuotes(items) {
  if (!items.length) return `<div class="empty-state"><div class="empty-state-inner"><h2>Sin cotizaciones</h2><p>No hay cotizaciones relacionadas con este cliente.</p></div></div>`;
  return `<div class="client-activity-list">${items.map(item => `<div class="client-activity-row"><span class="client-activity-copy"><strong>${escapeHtml(item.number || 'Cotización')}</strong><span>${escapeHtml(`${date(item.date)} · ${humanizeCode(item.status)}`)}</span></span><span class="client-activity-value">${escapeHtml(money(item.total || 0))}</span></div>`).join('')}</div>`;
}

function renderPayments(items) {
  if (!items.length) return `<div class="empty-state"><div class="empty-state-inner"><h2>Sin abonos</h2><p>No hay abonos relacionados con este cliente.</p></div></div>`;
  return `<div class="client-activity-list">${items.map(item => `<div class="client-activity-row"><span class="client-activity-copy"><strong>${escapeHtml(item.number || 'Abono')}</strong><span>${escapeHtml([date(item.date), item.orderNumber, humanizeCode(item.method)].filter(Boolean).join(' · '))}</span></span><span class="client-activity-value">${escapeHtml(money(item.value || 0))}</span></div>`).join('')}</div>`;
}

function renderClient(data) {
  const client = data.client || {};
  const summary = data.summary || {};
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];

  return `<section class="page">
    <div class="page-header"><div class="page-heading"><a class="link-action client-back-link" href="${escapeHtml(withPreview('/clientes.html'))}">‹ Clientes</a><h1>${escapeHtml(client.name || 'Cliente')}</h1><p>${escapeHtml(`${client.documentType || 'Documento'} ${client.document || ''}`.trim())}</p></div><div class="page-actions">${statusBadge(client.status || 'ACTIVO')}</div></div>

    <div class="client-profile-grid">
      <section class="client-profile-card">
        <div class="client-profile-head"><div><h2>Información del cliente</h2><p>Datos de contacto y origen comercial.</p></div></div>
        <div class="client-detail-list">
          ${detail('Teléfono', client.phone)}
          ${detail('Teléfono alterno', client.alternatePhone)}
          ${detail('Correo', client.email)}
          ${detail('Ciudad', client.city)}
          ${detail('Dirección', client.address)}
          ${detail('Sede de origen', client.branch)}
          ${detail('Fecha de registro', date(client.createdAt))}
          ${detail('Última compra', date(summary.lastPurchase))}
          ${client.notes ? detail('Notas', client.notes) : ''}
        </div>
      </section>

      <section class="client-profile-card">
        <div class="client-profile-head"><div><h2>Resumen comercial</h2><p>Lectura consolidada de su relación con Maderarte.</p></div></div>
        <div class="client-summary-grid">
          ${summaryCard('Órdenes', String(summary.orderCount || 0))}
          ${summaryCard('Cotizaciones', String(summary.quoteCount || 0))}
          ${summaryCard('Total vendido', money(summary.totalSold || 0))}
          ${summaryCard('Saldo pendiente', money(summary.balance || 0))}
        </div>
      </section>
    </div>

    <div class="client-sections">
      <section class="client-section"><div class="client-section-header"><h2>Órdenes de pedido</h2><span>${escapeHtml(`${orders.length} ${orders.length === 1 ? 'orden' : 'órdenes'}`)}</span></div>${renderOrders(orders)}</section>
      <section class="client-section"><div class="client-section-header"><h2>Cotizaciones</h2><span>${escapeHtml(`${quotes.length} ${quotes.length === 1 ? 'cotización' : 'cotizaciones'}`)}</span></div>${renderQuotes(quotes)}</section>
      <section class="client-section"><div class="client-section-header"><h2>Abonos</h2><span>${escapeHtml(`${payments.length} ${payments.length === 1 ? 'abono' : 'abonos'}`)}</span></div>${renderPayments(payments)}</section>
    </div>
  </section>`;
}

guardPage({
  permission: 'clientes.read',
  activeKey: 'clientes',
  title: 'Cliente',
  subtitle: 'Ficha comercial y actividad relacionada.',
  async render({ content }) {
    const document = clientDocument();
    if (!document) {
      content.innerHTML = `<section class="page">${emptyState({ icon: 'CL', title: 'Falta la identificación del cliente', message: 'Regresa al directorio y selecciona un cliente.' })}</section>`;
      return;
    }

    content.innerHTML = `<section class="page">${loadingState('Consultando cliente')}</section>`;
    try {
      const response = await requestData(document);
      if (!response.data) {
        content.innerHTML = `<section class="page">${emptyState({ icon: 'CL', title: 'Cliente no encontrado', message: 'No existe un cliente con esta identificación.' })}</section>`;
        return;
      }
      content.innerHTML = renderClient(response.data);
    } catch (error) {
      content.innerHTML = `<section class="page">${errorState(error.message, error.requestId)}</section>`;
    }
  }
});
