import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { date, dateTime, escapeHtml, humanizeCode, money, safeExternalUrl, text } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardStandalonePage } from '../core/page-guard.js';

const number = new URL(window.location.href).searchParams.get('op') || '';

function link(url, label) {
  const safe = safeExternalUrl(url);
  return safe ? `<a class="od-link" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(label)}</strong><span>Abrir documento</span></span><span class="od-link-arrow">↗</span></a>` : '';
}

function kv(label, value) {
  return `<div class="od-kv-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text(value))}</strong></div>`;
}

function loading() {
  return `<div class="od-loading"><div><div class="od-spinner"></div><strong>Abriendo expediente</strong></div></div>`;
}

function empty(message) {
  return `<div class="od-loading"><div><strong>${escapeHtml(message)}</strong></div></div>`;
}

function renderItems(items) {
  if (!items.length) return '<div class="od-empty">La orden todavía no tiene productos asociados.</div>';
  return `<div class="od-items">${items.map(item => `<article class="od-item"><div class="od-item-copy"><strong>${escapeHtml(item.description || 'Producto')}</strong><span>${escapeHtml([item.reference, item.measures, item.fabricColor, item.woodColor, item.specifications].filter(Boolean).join(' · ') || 'Sin especificaciones adicionales')}</span></div><div class="od-item-amount"><strong>${escapeHtml(String(item.quantity ?? 0))}</strong><span>${escapeHtml(item.unit || 'UNIDAD')}</span><small>${escapeHtml(money(item.subtotal))}</small></div></article>`).join('')}</div>`;
}

function renderPayments(payments) {
  if (!payments.length) return '<div class="od-empty">Todavía no hay abonos asociados a esta OP.</div>';
  return `<div class="od-timeline">${payments.map(payment => `<article class="od-timeline-row"><span class="od-money-pill">${escapeHtml(money(payment.value))}</span><span class="od-timeline-copy"><strong>${escapeHtml(dateTime(payment.date))} · ${escapeHtml(humanizeCode(payment.method || 'PAGO'))}</strong><span>${escapeHtml(payment.comment || payment.reference || 'Sin comentario')}</span></span>${link(payment.pdfUrl, 'Recibo')}</article>`).join('')}</div>`;
}

function renderRemissions(items) {
  if (!items.length) return '<div class="od-empty">No hay remisiones asociadas.</div>';
  return `<div class="od-timeline">${items.map(item => `<article class="od-timeline-row"><span class="od-timeline-copy"><strong>${escapeHtml(item.number || 'Remisión')}</strong><span>${escapeHtml(dateTime(item.date))} · ${escapeHtml(item.receiver || 'Sin receptor')}</span></span></article>`).join('')}</div>`;
}

function renderDocuments(items) {
  const links = items.map(item => link(item.url, item.name || item.type || 'Documento')).filter(Boolean).join('');
  return links || '<div class="od-empty">No hay documentos adicionales.</div>';
}

function renderOrder(data) {
  const order = data.order || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const remissions = Array.isArray(data.remissions) ? data.remissions : [];
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const primaryLinks = [link(order.pdfUrl, 'Orden de pedido'), link(order.clientFolderUrl, 'Carpeta del cliente'), link(order.orderFolderUrl, 'Carpeta de la OP')].filter(Boolean).join('');
  return `<header class="od-header"><div class="od-header-inner"><a class="od-round" href="${escapeHtml(withPreview('/ordenes.html'))}" aria-label="Volver al historial"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a><div class="od-brand"><strong>${escapeHtml(order.number || number)}</strong><span>Expediente de orden</span></div><a class="od-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Ir al inicio"><img src="/assets/icons/house.svg" alt="" aria-hidden="true"></a></div></header>
  <main class="od-shell">
    <section class="od-hero"><div class="od-hero-top"><div><span class="od-kicker">Orden de pedido</span><h1>${escapeHtml(order.number || number)}</h1><p>${escapeHtml(order.client || 'Expediente comercial')}</p></div><div class="od-status-group"><span class="od-pill">${escapeHtml(humanizeCode(order.status))}</span><span class="od-pill">${escapeHtml(humanizeCode(order.productionStatus))}</span></div></div></section>
    <section class="od-metrics"><article class="od-metric"><span>Valor total</span><strong>${escapeHtml(money(order.total))}</strong><small>Valor vigente</small></article><article class="od-metric"><span>Total abonado</span><strong>${escapeHtml(money(order.paid))}</strong><small>${payments.length} ${payments.length === 1 ? 'abono' : 'abonos'}</small></article><article class="od-metric"><span>Saldo pendiente</span><strong>${escapeHtml(money(order.balance))}</strong><small>Por recaudar</small></article><article class="od-metric"><span>Entrega estimada</span><strong>${escapeHtml(date(order.deliveryDate))}</strong><small>${escapeHtml(order.branch || '—')}</small></article></section>
    <div class="od-layout"><div class="od-stack"><section class="od-card"><div class="od-card-head"><h2>Datos de la orden</h2></div><div class="od-kv">${kv('Cliente', order.client)}${kv('Cédula o NIT', order.document)}${kv('Teléfono', order.phone)}${kv('Dirección de entrega', order.address)}${kv('Responsable', order.owner)}${kv('Modalidad', humanizeCode(order.saleMode))}${kv('Descripción', order.description)}${kv('Observaciones', order.notes)}</div></section><section class="od-card"><div class="od-card-head"><h2>Productos</h2><span class="od-count">${items.length}</span></div>${renderItems(items)}</section><section class="od-card"><div class="od-card-head"><h2>Abonos</h2><span class="od-count">${payments.length}</span></div>${renderPayments(payments)}</section></div>
    <aside class="od-stack"><section class="od-card"><div class="od-card-head"><h2>Documentos principales</h2></div>${primaryLinks || '<div class="od-empty">No hay enlaces disponibles todavía.</div>'}</section><section class="od-card"><div class="od-card-head"><h2>Remisiones</h2><span class="od-count">${remissions.length}</span></div>${renderRemissions(remissions)}</section><section class="od-card"><div class="od-card-head"><h2>Documentos</h2><span class="od-count">${documents.length}</span></div>${renderDocuments(documents)}</section></aside></div>
  </main>`;
}

guardStandalonePage({
  permission: 'ordenes.read',
  async render() {
    const root = document.getElementById('order-app');
    root.innerHTML = loading();
    root.hidden = false;
    if (!number) {
      root.innerHTML = empty('Falta el número de la orden.');
      return;
    }
    try {
      const response = previewApiData('ORDEN_OBTENER') || await apiRequest('ORDEN_OBTENER', { number });
      if (!response.data) {
        root.innerHTML = empty(`No existe la orden ${number} en la base actual.`);
        return;
      }
      root.innerHTML = renderOrder(response.data);
    } catch (error) {
      root.innerHTML = empty(error.message || 'No fue posible abrir el expediente.');
    }
  }
});
