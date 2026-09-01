import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { date, dateTime, escapeHtml, money, safeExternalUrl, text } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardPage } from '../core/page-guard.js';
import { emptyState, errorState, loadingState, statusBadge } from '../core/ui.js';

const number = new URL(window.location.href).searchParams.get('op') || '';

function keyValue(label, value) {
  return `<div class="key-value"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text(value))}</strong></div>`;
}

function externalLink(url, label) {
  const safe = safeExternalUrl(url);
  return safe ? `<a class="link-row" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer"><span class="link-copy"><strong>${escapeHtml(label)}</strong><span>Abrir documento en Drive</span></span><span>↗</span></a>` : '';
}

function renderOrder(data) {
  const order = data.order || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const remissions = Array.isArray(data.remissions) ? data.remissions : [];
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const primaryLinks = [
    externalLink(order.pdfUrl, 'Orden de pedido'),
    externalLink(order.clientFolderUrl, 'Carpeta del cliente'),
    externalLink(order.orderFolderUrl, 'Carpeta de la OP')
  ].filter(Boolean).join('');

  return `<div class="page-header"><div class="page-heading"><a class="link-action" href="${escapeHtml(withPreview('/ordenes.html'))}">← Volver a órdenes</a><h1>${escapeHtml(order.number || number)}</h1><p>${escapeHtml(order.client || 'Expediente de orden de pedido')}</p></div><div class="page-actions">${statusBadge(order.status)}${statusBadge(order.productionStatus)}</div></div>
    <div class="metric-strip"><article class="metric"><span>Valor total</span><strong>${escapeHtml(money(order.total))}</strong><small>Valor vigente de la orden</small></article><article class="metric"><span>Total abonado</span><strong>${escapeHtml(money(order.paid))}</strong><small>${payments.length} ${payments.length === 1 ? 'abono' : 'abonos'}</small></article><article class="metric"><span>Saldo pendiente</span><strong>${escapeHtml(money(order.balance))}</strong><small>Saldo calculado por el backend</small></article><article class="metric"><span>Entrega estimada</span><strong>${escapeHtml(date(order.deliveryDate))}</strong><small>${escapeHtml(order.branch || '—')}</small></article></div>
    <div class="order-layout">
      <div class="stack">
        <section class="card panel"><div class="panel-header"><h2>Datos de la orden</h2></div><div class="key-value-grid">${keyValue('Cliente', order.client)}${keyValue('Cédula o NIT', order.document)}${keyValue('Teléfono', order.phone)}${keyValue('Dirección de entrega', order.address)}${keyValue('Responsable', order.owner)}${keyValue('Modalidad', order.saleMode)}${keyValue('Descripción', order.description)}${keyValue('Observaciones', order.notes)}</div></section>
        <section class="card panel"><div class="panel-header"><h2>Productos</h2><span class="status-badge info">${items.length}</span></div>${items.length ? `<div class="item-list">${items.map(item => `<article class="item-row"><div class="item-row-copy"><strong>${escapeHtml(item.description || 'Producto')}</strong><span>${escapeHtml([item.reference, item.measures, item.fabricColor, item.woodColor].filter(Boolean).join(' · ') || 'Sin especificaciones adicionales')}</span></div><div class="item-row-amount"><strong>${escapeHtml(String(item.quantity ?? 0))}</strong><span>${escapeHtml(item.unit || 'UNIDAD')}</span><small>${escapeHtml(money(item.subtotal))}</small></div></article>`).join('')}</div>` : emptyState({ icon: '0', title: 'Sin productos', message: 'La orden no tiene productos asociados.' })}</section>
        <section class="card panel"><div class="panel-header"><h2>Abonos</h2><span class="status-badge info">${payments.length}</span></div>${payments.length ? `<div class="timeline-list">${payments.map(payment => `<article class="timeline-row"><span class="status-badge success">${escapeHtml(money(payment.value))}</span><span class="timeline-copy"><strong>${escapeHtml(dateTime(payment.date))} · ${escapeHtml(payment.method || 'Pago')}</strong><span>${escapeHtml(payment.comment || payment.reference || 'Sin comentario')}</span></span>${externalLink(payment.pdfUrl, 'Recibo')}</article>`).join('')}</div>` : emptyState({ icon: '0', title: 'Sin abonos', message: 'Todavía no hay pagos asociados a esta OP.' })}</section>
      </div>
      <aside class="stack">
        <section class="card panel"><div class="panel-header"><h2>Enlaces</h2></div><div class="link-list">${primaryLinks || '<p>No hay enlaces disponibles todavía.</p>'}</div></section>
        <section class="card panel"><div class="panel-header"><h2>Remisiones</h2><span class="status-badge info">${remissions.length}</span></div>${remissions.length ? `<div class="timeline-list">${remissions.map(item => `<article class="timeline-row"><span class="timeline-copy"><strong>${escapeHtml(item.number || 'Remisión')}</strong><span>${escapeHtml(dateTime(item.date))} · ${escapeHtml(item.receiver || '')}</span></span></article>`).join('')}</div>` : '<p>No hay remisiones asociadas.</p>'}</section>
        <section class="card panel"><div class="panel-header"><h2>Documentos</h2><span class="status-badge info">${documents.length}</span></div><div class="link-list">${documents.map(item => externalLink(item.url, item.name || item.type || 'Documento')).join('') || '<p>No hay documentos adicionales.</p>'}</div></section>
      </aside>
    </div>`;
}

guardPage({
  permission: 'ordenes.read',
  activeKey: 'ordenes',
  title: number ? `Expediente ${number}` : 'Expediente de orden',
  subtitle: 'Productos, pagos, saldo, documentos y entregas en un solo lugar.',
  async render({ content }) {
    content.innerHTML = `<section class="page" id="order-body">${loadingState('Consultando el expediente')}</section>`;
    const body = document.getElementById('order-body');
    if (!number) {
      body.innerHTML = emptyState({ icon: 'OP', title: 'Falta el número de orden', message: 'Abre el expediente desde el listado de órdenes.' });
      return;
    }
    try {
      const response = previewApiData('ORDEN_OBTENER') || await apiRequest('ORDEN_OBTENER', { number });
      if (!response.data) {
        body.innerHTML = emptyState({ icon: '0', title: 'Orden no encontrada', message: `No existe una orden ${number} en la base actual.` });
        return;
      }
      body.innerHTML = renderOrder(response.data);
    } catch (error) {
      body.innerHTML = errorState(error.message, error.requestId);
    }
  }
});
