import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { APP_CONFIG, withPreview } from '../core/config.js';
import { date, escapeHtml, humanizeCode, money, safeExternalUrl, statusTone } from '../core/format.js';
import { guardStandalonePage } from '../core/page-guard.js';
import { quoteDateInput, quoteAgeDays, resolveQuotePage } from '../core/quote-tracking.js';
import { documentSources } from '../core/document-url.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;
const state = { offset: 0, total: 0, hasMore: false, requestId: 0, searchTimer: null };
let pdfOpener = null;
let previousOverflow = '';

function readFilters(offset = 0) {
  const filters = {
    query: document.getElementById('tracking-search').value.trim(),
    from: document.getElementById('tracking-from').value,
    to: document.getElementById('tracking-to').value,
    branch: document.getElementById('tracking-branch').value,
    limit: PAGE_SIZE,
    offset
  };
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error('La fecha inicial debe ser anterior o igual a la final.');
  }
  return filters;
}

async function requestData(filters) {
  const preview = previewApiData('COTIZACIONES_LISTAR');
  const response = preview || await apiRequest('COTIZACIONES_LISTAR', filters);
  return resolveQuotePage(response.data, filters, Boolean(preview));
}

function startDefaultRange() {
  return new Date(Date.now() - 30 * DAY_MS);
}

function isConverted(item) {
  return Boolean(String(item.convertedOrder || '').trim()) || String(item.status || '').toUpperCase() === 'CONVERTIDA';
}

function ageMeta(item) {
  if (isConverted(item)) return { className: 'is-converted', label: 'Convertida' };
  const days = quoteAgeDays(item.date);
  if (days <= 7) return { className: 'age-recent', label: days === 0 ? 'Hoy' : `${days} ${days === 1 ? 'día' : 'días'}` };
  if (days <= 15) return { className: 'age-attention', label: `${days} días` };
  return { className: 'age-priority', label: `${days} días` };
}

function statusMarkup(value) {
  const tone = statusTone(value);
  return `<span class="tracking-status ${escapeHtml(tone)}">${escapeHtml(humanizeCode(value || 'ACTIVA'))}</span>`;
}

function loadingMarkup() {
  return `<div class="tracking-state"><div class="tracking-state-inner"><div class="tracking-spinner"></div><strong>Consultando cotizaciones</strong><span>Estamos organizando las propuestas y su antigüedad.</span></div></div>`;
}

function emptyMarkup() {
  return `<div class="tracking-state"><div class="tracking-state-inner"><div class="tracking-state-icon"><img src="/assets/icons/file-text.svg" alt="" aria-hidden="true"></div><strong>No hay cotizaciones en este rango</strong><span>Ajusta las fechas o la búsqueda. Cuando existan propuestas registradas aparecerán aquí.</span></div></div>`;
}

function errorMarkup(message) {
  return `<div class="tracking-state"><div class="tracking-state-inner"><div class="tracking-state-icon"><img src="/assets/icons/arrow-clockwise.svg" alt="" aria-hidden="true"></div><strong>No fue posible cargar el seguimiento</strong><span>${escapeHtml(message || 'Inténtalo nuevamente.')}</span></div></div>`;
}

function noteMarkup(item) {
  const text = String(item.observations || '').trim();
  if (!text) return `<div class="tracking-note is-empty"><div class="tracking-note-kicker">Observaciones</div><p>Sin observaciones comerciales registradas.</p></div>`;
  return `<div class="tracking-note"><div class="tracking-note-kicker">Observaciones</div><p>${escapeHtml(text)}</p></div>`;
}

function actionMarkup(item) {
  const pdf = safeExternalUrl(item.pdfUrl);
  const order = String(item.convertedOrder || '').trim();
  const actions = [];
  if (pdf) {
    actions.push(`<button class="tracking-action primary" type="button" data-pdf-url="${escapeHtml(pdf)}" data-pdf-number="${escapeHtml(item.number || '')}"><img src="/assets/icons/file-text.svg" alt="" aria-hidden="true"><span>Ver cotización</span></button>`);
  } else {
    actions.push(`<button class="tracking-action primary" type="button" disabled><img src="/assets/icons/file-text.svg" alt="" aria-hidden="true"><span>PDF pendiente</span></button>`);
  }
  if (order) {
    actions.push(`<a class="tracking-action" href="${escapeHtml(withPreview(`/orden.html?op=${encodeURIComponent(order)}`))}"><img src="/assets/icons/clipboard-text.svg" alt="" aria-hidden="true"><span>Ver ${escapeHtml(order)}</span></a>`);
  }
  return `<div class="tracking-card-actions${actions.length === 1 ? ' single' : ''}">${actions.join('')}</div>`;
}

function cardMarkup(item) {
  const age = ageMeta(item);
  const converted = isConverted(item);
  const description = String(item.description || '').trim();
  return `<article class="tracking-card ${escapeHtml(age.className)}">
    <div class="tracking-card-head">
      <div><div class="tracking-doc-number">${escapeHtml(item.number || 'Sin número')}</div><h2 class="tracking-client-name">${escapeHtml(item.client || 'Sin cliente')}</h2></div>
      <span class="tracking-age">${escapeHtml(age.label)}</span>
    </div>
    <div class="tracking-card-body">
      <div class="tracking-amount-label">Valor cotizado</div>
      <div class="tracking-amount">${escapeHtml(money(item.total || 0))}</div>
      <div class="tracking-meta">
        <span>${escapeHtml(date(item.date))}</span>
        <span>${escapeHtml(item.branch || '—')}</span>
        ${statusMarkup(item.status)}
      </div>
      ${description ? `<div class="tracking-meta"><span>${escapeHtml(description)}</span></div>` : ''}
      ${noteMarkup(item)}
      ${converted ? `<div class="tracking-converted">Convertida en la orden de pedido <strong>${escapeHtml(item.convertedOrder || '')}</strong>.</div>` : ''}
    </div>
    ${actionMarkup(item)}
  </article>`;
}

function updateSummary(summary = null) {
  document.getElementById('tracking-summary-count').textContent = summary ? String(summary.activeCount) : '—';
  document.getElementById('tracking-summary-amount').textContent = summary ? money(summary.activeAmount) : '—';
  for (const key of ['recent', 'attention', 'priority']) {
    document.getElementById(`tracking-radar-${key}-count`).textContent = summary ? String(summary.radar[key]) : '—';
  }
}

function updatePagination(loading = false) {
  document.getElementById('tracking-pagination').hidden = state.total <= PAGE_SIZE;
  document.getElementById('tracking-previous').disabled = loading || state.offset === 0;
  document.getElementById('tracking-next').disabled = loading || !state.hasMore;
  document.getElementById('tracking-page-label').textContent = `Página ${Math.floor(state.offset / PAGE_SIZE) + 1} de ${Math.max(1, Math.ceil(state.total / PAGE_SIZE))}`;
}

function updateResults(page) {
  state.offset = page.offset;
  state.total = page.total;
  state.hasMore = page.hasMore;
  updateSummary(page.summary);
  const count = document.getElementById('tracking-result-count');
  const root = document.getElementById('tracking-results');
  const totalLabel = `${page.total} ${page.total === 1 ? 'cotización' : 'cotizaciones'}`;
  count.textContent = page.total > PAGE_SIZE && page.items.length
    ? `${page.offset + 1}–${page.offset + page.items.length} de ${totalLabel}`
    : totalLabel;
  root.innerHTML = page.items.length ? `<div class="tracking-cards">${page.items.map(cardMarkup).join('')}</div>` : emptyMarkup();
  updatePagination();
  bindPdfButtons();
}

function filterItems() {
  window.clearTimeout(state.searchTimer);
  return loadQuotes(0);
}

function queueSearch() {
  window.clearTimeout(state.searchTimer);
  state.requestId += 1; // Invalidate an in-flight response as soon as the query changes.
  updateSummary();
  updatePagination(true);
  state.searchTimer = window.setTimeout(filterItems, 250);
}

function resetFilters(load = true) {
  document.getElementById('tracking-search').value = '';
  document.getElementById('tracking-from').value = quoteDateInput(startDefaultRange());
  document.getElementById('tracking-to').value = quoteDateInput(new Date());
  document.getElementById('tracking-branch').value = '';
  if (load) return filterItems();
}

function closePdf() {
  const overlay = document.getElementById('tracking-pdf-overlay');
  if (!overlay?.classList.contains('is-open')) return;
  const frame = document.getElementById('tracking-pdf-frame');
  overlay?.classList.remove('is-open');
  overlay?.setAttribute('aria-hidden', 'true');
  if (frame) frame.src = 'about:blank';
  document.getElementById('tracking-pdf-open')?.removeAttribute('href');
  document.getElementById('tracking-app').inert = false;
  document.body.style.overflow = previousOverflow;
  if (pdfOpener?.isConnected) pdfOpener.focus();
  pdfOpener = null;
}

function openPdf(url, number) {
  const sources = documentSources(url);
  if (!sources.external) return;
  const overlay = document.getElementById('tracking-pdf-overlay');
  const frame = document.getElementById('tracking-pdf-frame');
  const title = document.getElementById('tracking-pdf-number');
  if (!overlay || !frame) return;
  if (title) title.textContent = number || 'Cotización';
  pdfOpener = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.getElementById('tracking-pdf-open').href = sources.external;
  document.getElementById('tracking-pdf-help').textContent = sources.preview
    ? 'Si el documento no aparece o solicita acceso, ábrelo en otra pestaña con tu cuenta autorizada.'
    : 'Este documento se consulta en otra pestaña.';
  frame.hidden = !sources.preview;
  frame.src = sources.preview || 'about:blank';
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('tracking-app').inert = true;
  document.getElementById('tracking-pdf-close')?.focus();
}

function bindPdfButtons() {
  document.querySelectorAll('[data-pdf-url]').forEach(button => {
    button.addEventListener('click', () => openPdf(button.dataset.pdfUrl, button.dataset.pdfNumber));
  });
}

async function loadQuotes(offset = 0) {
  window.clearTimeout(state.searchTimer);
  const requestId = ++state.requestId;
  const refresh = document.getElementById('tracking-refresh');
  const results = document.getElementById('tracking-results');
  refresh.disabled = true;
  results.setAttribute('aria-busy', 'true');
  results.innerHTML = loadingMarkup();
  updateSummary();
  updatePagination(true);
  document.getElementById('tracking-result-count').textContent = 'Consultando…';
  try {
    let page = await requestData(readFilters(offset));
    if (requestId !== state.requestId) return;
    // A deletion or status change may remove the page that was just requested.
    if (offset > 0 && !page.items.length) page = await requestData(readFilters(0));
    if (requestId !== state.requestId) return;
    updateResults(page);
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.offset = 0;
    state.total = 0;
    state.hasMore = false;
    updateSummary();
    updatePagination();
    document.getElementById('tracking-result-count').textContent = 'Consulta pendiente';
    results.innerHTML = errorMarkup(error.message);
  } finally {
    if (requestId === state.requestId) {
      refresh.disabled = false;
      results.setAttribute('aria-busy', 'false');
    }
  }
}

function renderShell(root) {
  const environment = String(APP_CONFIG.environment || '').trim().toUpperCase() || 'APP';
  root.innerHTML = `<header class="tracking-header module-appbar">
    <div class="tracking-header-inner module-appbar-inner">
      <a class="tracking-round" href="${escapeHtml(withPreview('/index.html'))}" aria-label="Volver al inicio"><img src="/assets/icons/arrow-left.svg" alt="" aria-hidden="true"></a>
      <div class="tracking-brand module-brand" aria-label="Maderarte App">
        <img class="module-brand-mark" src="/assets/brand/maderarte-logo-2026.webp" alt="" aria-hidden="true">
        <div class="module-brand-lockup"><img class="module-brand-wordmark" src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"><span class="module-brand-section">Seguimiento comercial</span></div>
      </div>
      <button class="tracking-round" id="tracking-refresh" type="button" aria-label="Actualizar cotizaciones"><img src="/assets/icons/arrow-clockwise.svg" alt="" aria-hidden="true"></button>
    </div>
  </header>
  <main class="tracking-shell">
    <section class="tracking-command" aria-labelledby="tracking-title">
      <div class="tracking-command-copy">
        <div class="tracking-module-path"><span>Gestión comercial</span><b>/</b><span>Cotizaciones</span></div>
        <h1 id="tracking-title">Seguimiento</h1>
        <p>Un tablero para saber qué propuesta sigue viva, cuánto valor hay en juego y cuál necesita una nueva gestión comercial.</p>
      </div>
      <aside class="tracking-radar-panel" aria-label="Radar de oportunidades por antigüedad">
        <div class="tracking-radar-head"><div><span>Radar de oportunidades</span><strong>Antigüedad de propuestas abiertas</strong></div><small>Rango visible</small></div>
        <div class="tracking-radar-grid">
          <article class="tracking-radar-segment recent"><span>Recientes</span><strong id="tracking-radar-recent-count">0</strong><small>0–7 días</small></article>
          <article class="tracking-radar-segment attention"><span>Seguimiento</span><strong id="tracking-radar-attention-count">0</strong><small>8–15 días</small></article>
          <article class="tracking-radar-segment priority"><span>Prioridad</span><strong id="tracking-radar-priority-count">0</strong><small>+15 días</small></article>
        </div>
      </aside>
    </section>
    <section class="tracking-summary" aria-label="Resumen de cotizaciones">
      <article class="tracking-summary-card"><span class="tracking-summary-icon"><img src="/assets/icons/file-text.svg" alt="" aria-hidden="true"></span><div class="tracking-summary-copy"><span class="tracking-summary-label">En seguimiento</span><strong class="tracking-summary-value" id="tracking-summary-count">0</strong><span class="tracking-summary-note">Propuestas abiertas en el rango visible</span></div></article>
      <article class="tracking-summary-card amount"><span class="tracking-summary-icon gold"><img src="/assets/icons/chart-bar.svg" alt="" aria-hidden="true"></span><div class="tracking-summary-copy"><span class="tracking-summary-label">Valor en seguimiento</span><strong class="tracking-summary-value" id="tracking-summary-amount">$0</strong><span class="tracking-summary-note">Potencial comercial de propuestas abiertas</span></div></article>
    </section>
    <form class="tracking-filters" id="tracking-filter-form">
      <div class="tracking-filters-head"><div class="tracking-filters-title"><strong>Filtrar seguimiento</strong><span>Mostramos los últimos 30 días. Amplía el rango para consultar propuestas anteriores.</span></div><button class="tracking-reset" id="tracking-reset" type="button">Últimos 30 días</button></div>
      <div class="tracking-filter-grid">
        <div class="tracking-field search"><label for="tracking-search">Buscar</label><input class="tracking-control" id="tracking-search" type="search" placeholder="Cotización, cliente, identificación o teléfono" autocomplete="off"></div>
        <div class="tracking-field"><label for="tracking-from">Desde</label><input class="tracking-control" id="tracking-from" type="date"></div>
        <div class="tracking-field"><label for="tracking-to">Hasta</label><input class="tracking-control" id="tracking-to" type="date"></div>
        <div class="tracking-field branch"><label for="tracking-branch">Sede</label><select class="tracking-control" id="tracking-branch"><option value="">Todas</option><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div>
        <button class="tracking-apply" type="submit">Aplicar</button>
      </div>
    </form>
    <section><div class="tracking-results-head"><strong>Cotizaciones</strong><span id="tracking-result-count" role="status" aria-live="polite">0 cotizaciones</span></div><div id="tracking-results">${loadingMarkup()}</div>
      <nav class="tracking-pagination" id="tracking-pagination" aria-label="Páginas de cotizaciones" hidden>
        <button class="tracking-action" id="tracking-previous" type="button" disabled>Anterior</button>
        <span id="tracking-page-label" role="status" aria-live="polite"></span>
        <button class="tracking-action" id="tracking-next" type="button" disabled>Siguiente</button>
      </nav>
    </section>
    <footer class="tracking-footer module-footer" aria-label="Información del sistema">
      <div class="module-footer-identity"><img class="module-footer-maddy" src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte"><div class="module-footer-copy"><strong>Maderarte App</strong><span>Seguimiento comercial</span></div></div>
      <div class="module-footer-meta"><strong>Versión ${escapeHtml(APP_CONFIG.version)}</strong><span>Entorno · ${escapeHtml(environment)}</span></div>
    </footer>
  </main>
  <div class="tracking-pdf-overlay" id="tracking-pdf-overlay" aria-hidden="true">
    <section class="tracking-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="tracking-pdf-number">
      <header class="tracking-pdf-head"><div><span>Documento</span><strong id="tracking-pdf-number">Cotización</strong></div><button class="tracking-pdf-close" id="tracking-pdf-close" type="button" aria-label="Cerrar">×</button></header>
      <div class="tracking-pdf-help"><p id="tracking-pdf-help"></p><a class="tracking-action" id="tracking-pdf-open" target="_blank" rel="noopener noreferrer">Abrir documento en otra pestaña</a></div>
      <iframe class="tracking-pdf-frame" id="tracking-pdf-frame" title="Vista de cotización" src="about:blank" referrerpolicy="no-referrer"></iframe>
    </section>
  </div>`;
}

guardStandalonePage({
  permission: 'cotizaciones.read',
  async render() {
    const root = document.getElementById('tracking-app');
    renderShell(root);
    root.hidden = false;
    resetFilters(false);
    document.getElementById('tracking-filter-form').addEventListener('submit', event => { event.preventDefault(); filterItems(); });
    document.getElementById('tracking-reset').addEventListener('click', () => resetFilters());
    document.getElementById('tracking-refresh').addEventListener('click', () => loadQuotes(state.offset));
    document.getElementById('tracking-search').addEventListener('input', queueSearch);
    document.getElementById('tracking-branch').addEventListener('change', filterItems);
    document.getElementById('tracking-from').addEventListener('change', filterItems);
    document.getElementById('tracking-to').addEventListener('change', filterItems);
    document.getElementById('tracking-previous').addEventListener('click', () => loadQuotes(Math.max(0, state.offset - PAGE_SIZE)));
    document.getElementById('tracking-next').addEventListener('click', () => loadQuotes(state.offset + PAGE_SIZE));
    document.getElementById('tracking-pdf-close').addEventListener('click', closePdf);
    document.getElementById('tracking-pdf-overlay').addEventListener('click', event => { if (event.target.id === 'tracking-pdf-overlay') closePdf(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closePdf(); });
    await loadQuotes();
  }
});
