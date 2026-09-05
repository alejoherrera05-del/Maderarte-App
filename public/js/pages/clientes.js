import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { withPreview } from '../core/config.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { date, escapeHtml, humanizeCode, initials, money, normalizeCode, safeExternalUrl } from '../core/format.js';

const state = {
  session: null,
  suggestions: [],
  activeClient: null,
  searchTimer: 0
};

const app = () => document.getElementById('clients-app');
const searchInput = () => document.getElementById('clients-search-input');
const suggestionsEl = () => document.getElementById('clients-suggestions');
const messageEl = () => document.getElementById('clients-search-message');
const resultEl = () => document.getElementById('clients-result-content');

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
      return { status: 'success', code: 'BASE_ZERO_COMPAT', msg: 'Base comercial vacía.', data: { items: [], total: 0 }, requestId: error.requestId || '' };
    }
    throw error;
  }
}

async function requestClient(document) {
  const preview = previewApiData('CLIENTE_OBTENER');
  if (preview) return preview;
  try {
    return await apiRequest('CLIENTE_OBTENER', { document });
  } catch (error) {
    if (String(error?.code || '') === 'ACTION_NOT_FOUND' && await confirmZeroClients()) {
      return { status: 'success', code: 'BASE_ZERO_COMPAT', msg: 'Base comercial vacía.', data: null, requestId: error.requestId || '' };
    }
    throw error;
  }
}

function setMessage(message = '', isError = false) {
  const element = messageEl();
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-error', Boolean(isError));
}

function hideSuggestions() {
  const element = suggestionsEl();
  if (!element) return;
  element.hidden = true;
  element.innerHTML = '';
  state.suggestions = [];
}

function suggestionMarkup(item) {
  const secondary = [item.document, item.phone, item.city].filter(Boolean).join(' · ') || 'Sin datos adicionales';
  return `<button class="clients-suggestion" type="button" role="option" data-client-document="${escapeHtml(item.document)}">
    <span class="clients-suggestion-avatar">${escapeHtml(initials(item.name))}</span>
    <span class="clients-suggestion-copy"><strong>${escapeHtml(item.name || 'Sin nombre')}</strong><span>${escapeHtml(secondary)}</span></span>
    <span class="clients-suggestion-chevron" aria-hidden="true">›</span>
  </button>`;
}

function renderSuggestions(items) {
  const element = suggestionsEl();
  if (!element) return;
  state.suggestions = items;
  if (!items.length) {
    hideSuggestions();
    return;
  }
  element.innerHTML = items.slice(0, 8).map(suggestionMarkup).join('');
  element.hidden = false;
  element.querySelectorAll('[data-client-document]').forEach(button => {
    button.addEventListener('click', () => loadClient(button.dataset.clientDocument));
  });
}

async function updateSuggestions() {
  const query = searchInput()?.value.trim() || '';
  if (query.length < 2) {
    hideSuggestions();
    setMessage('');
    return;
  }
  try {
    const response = await requestClients({ query, limit: 8 });
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    renderSuggestions(items);
    if (!items.length) setMessage('No encontramos clientes con esa búsqueda.');
    else setMessage(`${items.length} ${items.length === 1 ? 'coincidencia' : 'coincidencias'}. Selecciona un cliente.`);
  } catch (error) {
    hideSuggestions();
    setMessage(error.message || 'No fue posible consultar clientes.', true);
  }
}

function statusClass(status) {
  const code = normalizeCode(status);
  if (['ANULADA', 'ANULADO', 'INACTIVO'].includes(code)) return 'is-danger';
  if (['PENDIENTE', 'EN_PROCESO', 'BORRADOR'].includes(code)) return 'is-warning';
  if (['COMPLETADA', 'COMPLETADO', 'CONVERTIDA'].includes(code)) return 'is-neutral';
  return '';
}

function paymentRows(payments) {
  if (!payments.length) return '<div class="client-empty-history">Todavía no hay abonos registrados para esta orden.</div>';
  const total = payments.reduce((sum, payment) => sum + Number(payment.value || 0), 0);
  return `${payments.map(payment => {
    const pdf = safeExternalUrl(payment.pdfUrl);
    const content = `<span class="client-payment-left"><span class="client-payment-icon">$</span><span class="client-payment-name">${escapeHtml(payment.number || humanizeCode(payment.method) || 'Abono')}</span></span><span class="client-payment-date">${escapeHtml(date(payment.date))}</span><strong class="client-payment-amount">${escapeHtml(money(payment.value))}</strong>`;
    return pdf ? `<a class="client-payment-row" href="${escapeHtml(pdf)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<div class="client-payment-row">${content}</div>`;
  }).join('')}<div class="client-payment-total"><span>Total abonado en movimientos</span><strong>${escapeHtml(money(total))}</strong></div>`;
}

function orderMarkup(order, allPayments, index) {
  const payments = allPayments.filter(payment => String(payment.orderNumber || '') === String(order.number || ''));
  const total = Number(order.total || 0);
  const paid = Number(order.paid || 0);
  const balance = Number(order.balance || 0);
  const progress = total > 0 ? Math.max(0, Math.min(100, (paid / total) * 100)) : 0;
  const historyId = `client-order-history-${index}`;
  const description = order.description || order.notes || 'Orden de pedido Maderarte';
  const orderUrl = withPreview(`/orden.html?op=${encodeURIComponent(order.number || '')}`);

  return `<article class="clients-card client-order">
    <div class="client-doc-head">
      <strong class="client-doc-code">${escapeHtml(order.number || 'OP')}</strong>
      <div class="client-doc-head-right"><span class="client-status ${statusClass(order.status)}">${escapeHtml(humanizeCode(order.status || 'ACTIVA'))}</span></div>
    </div>
    <div class="client-order-layout">
      <div><p class="client-order-desc">${escapeHtml(description)}</p><p class="client-doc-date">${escapeHtml(date(order.date))}${order.branch ? ` · ${escapeHtml(order.branch)}` : ''}</p></div>
      <div class="client-finance">
        <div class="client-finance-left"><div class="client-finance-label">Valor total</div><div class="client-total">${escapeHtml(money(total))}</div></div>
        <div>
          <div class="client-paid-head"><span>Abonado</span><strong>${escapeHtml(money(paid))}</strong></div>
          <div class="client-progress" aria-label="Porcentaje abonado"><span style="width:${progress.toFixed(1)}%"></span></div>
          <div class="client-balance-label">Saldo pendiente</div><div class="client-balance">${escapeHtml(money(balance))}</div>
        </div>
      </div>
    </div>
    <div class="client-doc-actions">
      <button class="client-history-toggle" type="button" aria-expanded="false" aria-controls="${historyId}" data-history-target="${historyId}">Historial de abonos <span class="client-history-count">${payments.length}</span><span class="client-history-chevron">⌄</span></button>
      <a class="client-view-doc" href="${escapeHtml(orderUrl)}">Ver expediente</a>
    </div>
    <div class="client-history-panel" id="${historyId}"><div class="client-history-box"><div class="client-history-title">Movimientos de esta orden</div>${paymentRows(payments)}</div></div>
  </article>`;
}

function quoteMarkup(quote) {
  const pdf = safeExternalUrl(quote.pdfUrl);
  const orderUrl = quote.convertedOrder ? withPreview(`/orden.html?op=${encodeURIComponent(quote.convertedOrder)}`) : '';
  const description = quote.description || quote.notes || 'Cotización Maderarte';
  return `<article class="clients-card client-quote">
    <div class="client-doc-head"><strong class="client-doc-code">${escapeHtml(quote.number || 'Cotización')}</strong><div class="client-doc-head-right"><span class="client-status ${statusClass(quote.status)}">${escapeHtml(humanizeCode(quote.status || 'BORRADOR'))}</span></div></div>
    <div class="client-quote-body">${escapeHtml(description)}<div class="client-doc-date">${escapeHtml(date(quote.date))}${quote.branch ? ` · ${escapeHtml(quote.branch)}` : ''}</div></div>
    <div class="client-quote-total"><span>Valor cotizado</span><strong>${escapeHtml(money(quote.total))}</strong></div>
    ${(pdf || orderUrl) ? `<div class="client-quote-actions">${pdf ? `<a class="client-quote-action" href="${escapeHtml(pdf)}" target="_blank" rel="noopener noreferrer">Ver PDF</a>` : ''}${orderUrl ? `<a class="client-quote-action primary" href="${escapeHtml(orderUrl)}">Ver OP convertida</a>` : ''}</div>` : ''}
  </article>`;
}

function contactHrefPhone(phone) {
  const normalized = String(phone || '').replace(/[^+\d]/g, '');
  return normalized ? `tel:${normalized}` : '';
}

function whatsappHref(phone) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return '';
  const international = normalized.length === 10 ? `57${normalized}` : normalized;
  return `https://wa.me/${encodeURIComponent(international)}`;
}

function renderClientDossier(data) {
  const client = data?.client || {};
  const summary = data?.summary || {};
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const phoneHref = contactHrefPhone(client.phone);
  const whatsApp = whatsappHref(client.phone);
  const email = String(client.email || '').trim();
  const address = [client.address, client.city].filter(Boolean).join(' · ') || 'Sin dirección registrada';

  return `<section class="clients-card client-contact-card">
    <div class="client-identity">
      <div class="client-avatar" aria-hidden="true">${escapeHtml(initials(client.name))}</div>
      <div><h1 class="client-name">${escapeHtml(client.name || 'Cliente Maderarte')}</h1><div class="client-id-label">${escapeHtml(client.documentType || 'Identificación')}</div><div class="client-id">${escapeHtml(client.document || '—')}</div></div>
      <button class="client-more" type="button" aria-label="Más datos del cliente" title="Consulta en modo lectura"><img src="/assets/icons/dots-three.svg" alt="" aria-hidden="true"></button>
    </div>

    <div class="client-contact-grid">
      <div class="client-contact-item"><span class="client-contact-icon"><img src="/assets/icons/phone.svg" alt="" aria-hidden="true"></span><span><span class="client-contact-label">Teléfono</span><span class="client-contact-value">${escapeHtml(client.phone || 'Sin teléfono')}</span></span></div>
      <div class="client-contact-item"><span class="client-contact-icon"><img src="/assets/icons/map-pin.svg" alt="" aria-hidden="true"></span><span><span class="client-contact-label">Dirección</span><span class="client-contact-value">${escapeHtml(address)}</span></span></div>
    </div>
    <div class="client-email-row"><span class="client-contact-icon"><img src="/assets/icons/envelope.svg" alt="" aria-hidden="true"></span><span>${escapeHtml(email || 'Sin correo registrado')}</span></div>

    ${(whatsApp || phoneHref || email) ? `<div class="client-contact-actions">${whatsApp ? `<a class="client-primary-contact" href="${escapeHtml(whatsApp)}" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>` : phoneHref ? `<a class="client-primary-contact" href="${escapeHtml(phoneHref)}">Llamar cliente</a>` : `<a class="client-primary-contact" href="mailto:${encodeURIComponent(email)}">Enviar correo</a>`}${phoneHref && whatsApp ? `<a class="client-secondary-contact" href="${escapeHtml(phoneHref)}">Llamar</a>` : email ? `<a class="client-secondary-contact" href="mailto:${encodeURIComponent(email)}">Correo</a>` : ''}</div>` : ''}

    <div class="client-readonly-note">Consulta en modo lectura. La creación y edición comercial se habilitarán en la etapa de escrituras.</div>
  </section>

  <section class="client-summary" aria-label="Resumen comercial"><span class="client-summary-icon">$</span><div class="client-summary-text"><strong>${summary.orders || orders.length} ${(summary.orders || orders.length) === 1 ? 'orden' : 'órdenes'}</strong><span class="client-summary-dot">•</span><strong>${summary.quotes || quotes.length} ${(summary.quotes || quotes.length) === 1 ? 'cotización' : 'cotizaciones'}</strong><span class="client-summary-dot">•</span><span class="pending">${escapeHtml(money(summary.balance || 0))} pendiente</span></div></section>

  <div class="client-tabs" role="tablist" aria-label="Historial del cliente"><button class="client-tab is-active" type="button" role="tab" aria-selected="true" data-client-tab="orders">Órdenes <span class="client-tab-count">${orders.length}</span></button><button class="client-tab" type="button" role="tab" aria-selected="false" data-client-tab="quotes">Cotizaciones <span class="client-tab-count">${quotes.length}</span></button></div>
  <section class="client-panel is-active" data-client-panel="orders">${orders.length ? orders.map((order, index) => orderMarkup(order, payments, index)).join('') : '<div class="client-empty-panel">Este cliente todavía no tiene órdenes de pedido.</div>'}</section>
  <section class="client-panel" data-client-panel="quotes">${quotes.length ? quotes.map(quoteMarkup).join('') : '<div class="client-empty-panel">Este cliente todavía no tiene cotizaciones.</div>'}</section>`;
}

function renderLoading() {
  const element = resultEl();
  if (!element) return;
  element.innerHTML = '<div class="clients-loading"><img src="/assets/icons/magnifying-glass.svg" alt="" aria-hidden="true"><p>Consultando el expediente del cliente…</p></div>';
}

function renderNotFound() {
  const element = resultEl();
  if (!element) return;
  element.innerHTML = '<div class="clients-not-found"><img src="/assets/icons/magnifying-glass.svg" alt="" aria-hidden="true"><h2>Cliente no encontrado</h2><p>Revisa la identificación o el nombre e intenta una nueva búsqueda.</p></div>';
}

function renderError(error) {
  const element = resultEl();
  if (!element) return;
  const code = String(error?.code || '');
  const deploymentMessage = code === 'ACTION_NOT_FOUND'
    ? 'La interfaz de Clientes está lista, pero el Cerebro publicado aún no tiene desplegadas las rutas de lectura de esta etapa.'
    : (error?.message || 'No fue posible consultar el cliente.');
  element.innerHTML = `<div class="clients-error"><h2>No pudimos abrir el expediente</h2><p>${escapeHtml(deploymentMessage)}</p>${error?.requestId ? `<p>Referencia: ${escapeHtml(error.requestId)}</p>` : ''}</div>`;
}

function bindDossierInteractions() {
  document.querySelectorAll('[data-client-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.clientTab;
      document.querySelectorAll('[data-client-tab]').forEach(other => {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-client-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.clientPanel === tab));
    });
  });

  document.querySelectorAll('[data-history-target]').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.dataset.historyTarget);
      if (!panel) return;
      const open = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    });
  });
}

function openResults(document) {
  app()?.classList.add('is-results');
  const url = new URL(window.location.href);
  url.searchParams.set('search', document);
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

function returnToSearch({ clear = true } = {}) {
  app()?.classList.remove('is-results');
  state.activeClient = null;
  if (clear && searchInput()) searchInput().value = '';
  hideSuggestions();
  setMessage('');
  const url = new URL(window.location.href);
  url.searchParams.delete('search');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  window.setTimeout(() => {
    if (resultEl()) resultEl().innerHTML = '';
    searchInput()?.focus({ preventScroll: true });
  }, 380);
}

async function loadClient(document) {
  const normalized = String(document || '').trim();
  if (!normalized) return;
  hideSuggestions();
  openResults(normalized);
  renderLoading();
  try {
    const response = await requestClient(normalized);
    if (!response.data?.client) {
      renderNotFound();
      return;
    }
    state.activeClient = response.data;
    resultEl().innerHTML = renderClientDossier(response.data);
    bindDossierInteractions();
  } catch (error) {
    renderError(error);
  }
}

async function submitSearch() {
  const query = searchInput()?.value.trim() || '';
  if (!query) {
    setMessage('Escribe la identificación o el nombre del cliente.', true);
    return;
  }
  setMessage('Buscando…');
  try {
    const response = await requestClients({ query, limit: 12 });
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    if (!items.length) {
      hideSuggestions();
      setMessage('No encontramos un cliente con esa búsqueda.', true);
      return;
    }
    const exact = items.find(item => String(item.document || '').toLowerCase() === query.toLowerCase() || String(item.name || '').toLowerCase() === query.toLowerCase());
    if (exact || items.length === 1) {
      await loadClient((exact || items[0]).document);
      return;
    }
    renderSuggestions(items);
    setMessage('Encontramos varias coincidencias. Selecciona el cliente correcto.');
  } catch (error) {
    hideSuggestions();
    setMessage(error.message || 'No fue posible consultar clientes.', true);
  }
}

function bindSearchInteractions() {
  const form = document.getElementById('clients-search-form');
  const input = searchInput();
  form?.addEventListener('submit', event => {
    event.preventDefault();
    submitSearch();
  });
  input?.addEventListener('input', () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(updateSuggestions, 230);
  });
  input?.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideSuggestions();
  });
  document.addEventListener('click', event => {
    const suggestions = suggestionsEl();
    if (!suggestions?.hidden && !suggestions.contains(event.target) && event.target !== input) hideSuggestions();
  });
  document.getElementById('clients-new-search')?.addEventListener('click', () => returnToSearch());
  document.getElementById('clients-result-back')?.addEventListener('click', () => window.location.assign(withPreview('/index.html')));
}

guardStandalonePage({
  permission: 'clientes.read',
  async render({ session }) {
    state.session = session;
    const root = app();
    if (!root) return;
    root.hidden = false;
    bindSearchInteractions();

    const params = new URLSearchParams(window.location.search);
    const autoSearch = params.get('search');
    if (autoSearch) {
      if (searchInput()) searchInput().value = autoSearch;
      try {
        const response = await requestClients({ query: autoSearch, limit: 12 });
        const items = Array.isArray(response.data?.items) ? response.data.items : [];
        const exact = items.find(item => String(item.document || '').toLowerCase() === autoSearch.toLowerCase()) || items[0];
        if (exact) await loadClient(exact.document);
        else setMessage('No encontramos un cliente con esa búsqueda.', true);
      } catch (error) {
        setMessage(error.message || 'No fue posible consultar clientes.', true);
      }
    } else {
      searchInput()?.focus({ preventScroll: true });
    }
  }
});
