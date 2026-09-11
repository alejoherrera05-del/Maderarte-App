import { bindProductionTracking } from '../core/production-tracking.js?v=runtime-1';
import { renderWorkbench, bindWorkbench } from '../core/order-workbench.js?v=production-actions-1';
import { productState, bindProductJourney } from '../core/product-journey.js?v=actions-1';
import { hasPermission } from '../core/permissions.js';
import { bindSandboxBanner, sandboxLink } from '../core/order-sandbox-context.js';
import { bindOrderDocuments } from './orden-documentos.js?v=production-actions-1';
import { apiRequest } from '../core/api.js?v=runtime-1';
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
  return `<header class="od-header"><div class="od-header-inner"><a class="od-round" href="${escapeHtml(withPreview('/ordenes.html'))}" aria-label="Volver al historial"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a><div class="ow-header-brand"><img src="/assets/brand/maderarte-logo-2026.webp" alt=""><img src="/assets/brand/maderarte-wordmark-algerian.png" alt="Maderarte"><span>Orden de pedido</span></div><a class="od-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Ir al inicio"><img src="/assets/icons/house.svg" alt="" aria-hidden="true"></a></div></header>
  <main class="od-shell">
    <section class="ow-summary od-hero"><div><span>Orden de pedido</span><strong>${escapeHtml(order.number || number)}</strong><small>${escapeHtml(order.client)}</small></div><div><span>Fecha</span><strong>${escapeHtml(date(order.date))}</strong><small>${escapeHtml(order.city || '')}</small></div><div><span>Valor total</span><strong>${escapeHtml(money(order.total))}</strong></div><div><span>Abonado</span><strong>${escapeHtml(money(order.paid))}</strong></div><div><span>Saldo pendiente</span><strong>${escapeHtml(money(order.balance))}</strong></div></section>
    <nav class="ow-order-tabs" aria-label="Secciones de la orden">${['Muebles','Cliente','Abonos','Remisiones','Documentos'].map((label,i)=>`<button type="button" data-order-section="${i}" aria-pressed="${i===0}">${label}</button>`).join('')}</nav>${renderWorkbench(items,order,session)}
    <div class="od-layout ow-support"><div class="od-stack">
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
      bindProductJourney(root,response.data,session);
      bindWorkbench(root,response.data,session); void bindProductionTracking(root,response.data,session);
      const support=root.querySelector('.ow-support'), workbench=root.querySelector('.ow-workbench');
      support.hidden=true;
      root.querySelectorAll('[data-order-section]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.orderSection);
        root.querySelectorAll('[data-order-section]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
        workbench.hidden=index!==0;support.hidden=index===0;
        const sections=[...support.querySelector('.od-stack').children];
        sections.forEach((el,i)=>{el.hidden=i!==index-1;const details=el.querySelector('details');if(details)details.open=i===index-1;});
        support.querySelector('aside.od-stack').hidden=index!==4;
      }));
      if (response.data.mediaWorkflow === 1) void bindOrderDocuments(root, number);
    } catch (error) {
      root.innerHTML = empty(error.message || 'No fue posible abrir el expediente.');
    }
  }
});

