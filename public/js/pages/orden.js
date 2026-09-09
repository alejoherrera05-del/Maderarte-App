import { productState, bindProductJourney } from '../core/product-journey.js';
import { hasPermission } from '../core/permissions.js';
import { bindSandboxBanner, sandboxLink } from '../core/order-sandbox-context.js';
import { bindOrderDocuments } from './orden-documentos.js?v=family-1';
import { apiRequest } from '../core/api.js?v=sandbox-1';
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

function renderItems(items, order) {
  if (!items.length) return '<div class="od-empty">La orden todavía no tiene productos asociados.</div>';
  return `<div class="od-items">${items.map(item => {
    const state=productState(item,order);
    return `<article class="od-item" data-order-item="${escapeHtml(item.id)}"><div class="product-symbol"><img src="/assets/icons/stack.svg" alt=""></div><div class="od-item-copy"><strong>${escapeHtml(item.description || 'Producto')}</strong><span>${escapeHtml([item.fabricColor,item.woodColor,item.specifications].filter(Boolean).join(' · ') || 'Sin personalización')}</span><button type="button" class="product-status tone-${state.tone}" data-product-journey="${escapeHtml(item.id)}">${escapeHtml(state.label)}<img src="/assets/icons/caret-right.svg" alt=""></button></div><div class="od-item-amount"><strong>${escapeHtml(String(item.quantity ?? 0))} ${escapeHtml(item.unit||'UN')}</strong><small>${escapeHtml(money(item.subtotal))}</small>${item.delivered>0?`<span class="${item.pending===0?'od-dispatch-complete':'od-dispatch-partial'}">${item.pending===0?'✓ Despacho completo':escapeHtml(item.delivered+' despachadas · '+item.pending+' pendientes')}</span>`:''}</div></article>`;
  }).join('')}</div>`;
}

function renderPayments(payments) {
  if (!payments.length) return '<div class="od-empty">Todavía no hay abonos asociados a esta OP.</div>';
  return `<div class="od-timeline">${payments.map(payment => `<article class="od-timeline-row"><span class="od-money-pill">${escapeHtml(money(payment.value))}</span><span class="od-timeline-copy"><strong>${escapeHtml(dateTime(payment.date))} · ${escapeHtml(humanizeCode(payment.method || 'PAGO'))}</strong><span>${escapeHtml(payment.comment || payment.reference || 'Sin comentario')}</span></span>${link(payment.pdfUrl, 'Recibo')}</article>`).join('')}</div>`;
}

function renderRemissions(items) {
  if (!items.length) return '<div class="od-empty">No hay remisiones asociadas.</div>';
  return `<div class="od-timeline">${items.map(item => `<article class="od-timeline-row"><span class="od-timeline-copy"><a href="${escapeHtml(sandboxLink('/remision.html?remision=' + encodeURIComponent(item.number)))}"><strong>${escapeHtml(item.number || 'Remisión')}</strong></a><span>${escapeHtml(dateTime(item.date))} · ${escapeHtml(item.dispatcher ? 'Despacha ' + item.dispatcher : 'Salida del almacén')}</span></span></article>`).join('')}</div>`;
}

function renderDocuments(items) {
  const links = items.map(item => link(item.url, item.name || item.type || 'Documento')).filter(Boolean).join('');
  return links || '<div class="od-empty">No hay documentos adicionales.</div>';
}

function renderOrder(data, session) {
  const order = data.order || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const remissions = Array.isArray(data.remissions) ? data.remissions : [];
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const primaryLinks = [link(order.pdfUrl, 'Orden de pedido'), link(order.clientFolderUrl, 'Carpeta del cliente'), link(order.orderFolderUrl, 'Carpeta de la OP')].filter(Boolean).join('');
  const quoteLink = order.quoteOrigin ? `<a class="od-link" href="${escapeHtml(sandboxLink('/cotizacion-ver.html?cot=' + encodeURIComponent(order.quoteOrigin)))}"><span><strong>Cotización de origen ${escapeHtml(order.quoteOrigin)}</strong><span>Abrir propuesta</span></span><span class="od-link-arrow">↗</span></a>` : '';
  return `<header class="od-header"><div class="od-header-inner"><a class="od-round" href="${escapeHtml(withPreview('/ordenes.html'))}" aria-label="Volver al historial"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a><div class="od-brand"><strong>${escapeHtml(order.number || number)}</strong><span>Expediente de orden</span></div><a class="od-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Ir al inicio"><img src="/assets/icons/house.svg" alt="" aria-hidden="true"></a></div></header>
  <main class="od-shell">
    <section class="od-hero"><div class="od-hero-top"><div><span class="od-kicker">Orden de pedido · ${escapeHtml(date(order.date))}</span><h1>${escapeHtml(order.number || number)}</h1><p>${escapeHtml(order.client || 'Expediente comercial')}</p></div><span class="product-status tone-green">${escapeHtml(humanizeCode(order.status))}</span></div>
    <nav class="order-actions" aria-label="Acciones de la orden">${hasPermission(session,'produccion.read')?`<a href="${escapeHtml(sandboxLink('/produccion.html?op='+encodeURIComponent(order.number)))}"><img src="/assets/icons/clipboard-text.svg" alt="">Solicitar a fábrica</a>`:''}${hasPermission(session,'abonos.read')?`<a href="${escapeHtml(sandboxLink('/abono.html?op='+encodeURIComponent(order.number)))}"><img src="/assets/icons/wallet.svg" alt="">Registrar abono</a>`:''}${hasPermission(session,'remisiones.read')?`<a href="${escapeHtml(sandboxLink('/remision.html?op='+encodeURIComponent(order.number)))}"><img src="/assets/icons/truck.svg" alt="">Preparar remisión</a>`:''}</nav></section>
    <div class="od-layout"><div class="od-stack"><section class="od-card order-products"><div class="od-card-head"><div><h2>Estado de los muebles</h2><p>Toca el estado para ver su recorrido.</p></div><span class="od-count">${items.length}</span></div>${renderItems(items,order)}</section>
    <section class="od-card"><details class="order-disclosure"><summary><span>Cliente y acuerdos</span><img src="/assets/icons/caret-down.svg" alt=""></summary><div class="od-kv">${kv('Cliente', order.client)}${kv('Cédula o NIT', order.document)}${kv('Teléfono', order.phone)}${order.alternatePhone ? kv('Segundo teléfono', order.alternatePhone) : ''}${kv('Correo', order.email)}${kv('Ciudad', order.city)}${kv('Dirección de entrega', order.address)}${kv('Responsable', order.owner)}${kv('Observaciones', order.notes)}</div></details></section>
    <section class="od-card"><details class="order-disclosure"><summary><span>Abonos <small>${payments.length}</small></span><img src="/assets/icons/caret-down.svg" alt=""></summary>${renderPayments(payments)}</details></section>
    <section class="od-card"><details class="order-disclosure"><summary><span>Remisiones <small>${remissions.length}</small></span><img src="/assets/icons/caret-down.svg" alt=""></summary>${renderRemissions(remissions)}</details></section></div>
    <aside class="od-stack"><section class="od-card order-balance"><span>Saldo pendiente</span><strong>${escapeHtml(money(order.balance))}</strong><dl><div><dt>Valor total</dt><dd>${escapeHtml(money(order.total))}</dd></div><div><dt>Abonado</dt><dd>${escapeHtml(money(order.paid))}</dd></div><div><dt>Entrega estimada</dt><dd>${escapeHtml(date(order.deliveryDate))}</dd></div></dl></section><section class="od-card"><div class="od-card-head"><h2>Archivo de la orden</h2></div>${quoteLink}${primaryLinks||'<div class="od-empty">Sin archivos todavía.</div>'}<details class="order-disclosure order-other-docs"><summary>Otros documentos</summary>${renderDocuments(documents)}</details></section><div class="order-brand-signature"><img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte"></div></aside></div>
  </main>`;
}

guardStandalonePage({
  permission: 'ordenes.read',
  async render({ session }) {
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
      root.innerHTML = renderOrder(response.data, session);
      bindSandboxBanner(root);
      bindProductJourney(root,response.data);
      if (response.data.mediaWorkflow === 1) void bindOrderDocuments(root, number);
    } catch (error) {
      root.innerHTML = empty(error.message || 'No fue posible abrir el expediente.');
    }
  }
});
