import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { APP_CONFIG, withPreview } from '../core/config.js';
import { date, escapeHtml, humanizeCode, money, safeExternalUrl, statusTone } from '../core/format.js';
import { guardStandalonePage } from '../core/page-guard.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const state = { items: [], filtered: [] };

function requestData() {
  return previewApiData('COTIZACIONES_LISTAR') || apiRequest('COTIZACIONES_LISTAR', { limit: 100 });
}

function localDateInput(dateValue) {
  const dateObject = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dateObject.getTime())) return '';
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, '0');
  const day = String(dateObject.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startDefaultRange() {
  return new Date(Date.now() - 30 * DAY_MS);
}

function ageDays(value) {
  const issued = new Date(value || 0);
  if (Number.isNaN(issued.getTime())) return 0;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const issuedStart = new Date(issued.getFullYear(), issued.getMonth(), issued.getDate()).getTime();
  return Math.max(0, Math.floor((todayStart - issuedStart) / DAY_MS));
}

function isConverted(item) {
  return Boolean(String(item.convertedOrder || '').trim()) || String(item.status || '').toUpperCase() === 'CONVERTIDA';
}

function isClosed(item) {
  return isConverted(item) || ['ARCHIVADA', 'ANULADA'].includes(String(item.status || '').toUpperCase());
}

function ageMeta(item) {
  if (isConverted(item)) return { className: 'is-converted', label: 'Convertida' };
  const days = ageDays(item.date);
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

function updateRadar(items) {
  const counts = { recent: 0, attention: 0, priority: 0 };
  items.filter(item => !isClosed(item)).forEach(item => {
    const days = ageDays(item.date);
    if (days <= 7) counts.recent += 1;
    else if (days <= 15) counts.attention += 1;
    else counts.priority += 1;
  });
  const recent = document.getElementById('tracking-radar-recent-count');
  const attention = document.getElementById('tracking-radar-attention-count');
  const priority = document.getElementById('tracking-radar-priority-count');
  if (recent) recent.textContent = String(counts.recent);
  if (attention) attention.textContent = String(counts.attention);
  if (priority) priority.textContent = String(counts.priority);
}

function updateSummary(items) {
  const active = items.filter(item => !isClosed(item));
  const amount = active.reduce((sum, item) => sum + Number(item.total || 0), 0);
  document.getElementById('tracking-summary-count').textContent = String(active.length);
  document.getElementById('tracking-summary-amount').textContent = money(amount);
  updateRadar(items);
}

function updateResults(items) {
  state.filtered = items;
  updateSummary(items);
  const count = document.getElementById('tracking-result-count');
  const root = document.getElementById('tracking-results');
  count.textContent = `${items.length} ${items.length === 1 ? 'cotización' : 'cotizaciones'}`;
  if (!items.length) {
    root.innerHTML = emptyMarkup();
    return;
  }
  root.innerHTML = `<div class="tracking-cards">${items.map(cardMarkup).join('')}</div>`;
  bindPdfButtons();
}

function filterItems() {
  const query = document.getElementById('tracking-search').value.trim().toLowerCase();
  const from = document.getElementById('tracking-from').value;
  const to = document.getElementById('tracking-to').value;
  const branch = document.getElementById('tracking-branch').value;
  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : 0;
  const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

  const filtered = state.items.filter(item => {
    const timestamp = new Date(item.date || 0).getTime();
    if (from && (!timestamp || timestamp < fromTime)) return false;
    if (to && (!timestamp || timestamp > toTime)) return false;
    if (branch && String(item.branch || '') !== branch) return false;
    if (!query) return true;
    return [item.number, item.document, item.client, item.phone, item.description, item.observations]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  updateResults(filtered);
}

function resetFilters() {
  document.getElementById('tracking-search').value = '';
  document.getElementById('tracking-from').value = localDateInput(startDefaultRange());
  document.getElementById('tracking-to').value = localDateInput(new Date());
  document.getElementById('tracking-branch').value = '';
  filterItems();
}

function closePdf() {
  const overlay = document.getElementById('tracking-pdf-overlay');
  const frame = document.getElementById('tracking-pdf-frame');
  overlay?.classList.remove('is-open');
  overlay?.setAttribute('aria-hidden', 'true');
  if (frame) frame.src = 'about:blank';
  document.body.style.overflow = '';
}

function openPdf(url, number) {
  const safe = safeExternalUrl(url);
  if (!safe) return;
  const overlay = document.getElementById('tracking-pdf-overlay');
  const frame = document.getElementById('tracking-pdf-frame');
  const title = document.getElementById('tracking-pdf-number');
  if (!overlay || !frame) return;
  if (title) title.textContent = number || 'Cotización';
  frame.src = safe;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => document.getElementById('tracking-pdf-close')?.focus(), 120);
}

function bindPdfButtons() {
  document.querySelectorAll('[data-pdf-url]').forEach(button => {
    button.addEventListener('click', () => openPdf(button.dataset.pdfUrl, button.dataset.pdfNumber));
  });
}

async function loadQuotes() {
  const refresh = document.getElementById('tracking-refresh');
  const results = document.getElementById('tracking-results');
  refresh.disabled = true;
  results.innerHTML = loadingMarkup();
  document.getElementById('tracking-result-count').textContent = 'Consultando…';
  try {
    const response = await requestData();
    state.items = Array.isArray(response.data?.items) ? response.data.items : [];
    filterItems();
  } catch (error) {
    state.items = [];
    state.filtered = [];
    updateSummary([]);
    document.getElementById('tracking-result-count').textContent = 'Sin datos';
    results.innerHTML = errorMarkup(error.message);
  } finally {
    refresh.disabled = false;
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
      <div class="tracking-filters-head"><div class="tracking-filters-title"><strong>Filtrar seguimiento</strong><span>Por defecto mostramos los últimos 30 días para no esconder oportunidades antiguas.</span></div><button class="tracking-reset" id="tracking-reset" type="button">Últimos 30 días</button></div>
      <div class="tracking-filter-grid">
        <div class="tracking-field search"><label for="tracking-search">Buscar</label><input class="tracking-control" id="tracking-search" type="search" placeholder="Cotización, cliente, identificación o teléfono" autocomplete="off"></div>
        <div class="tracking-field"><label for="tracking-from">Desde</label><input class="tracking-control" id="tracking-from" type="date"></div>
        <div class="tracking-field"><label for="tracking-to">Hasta</label><input class="tracking-control" id="tracking-to" type="date"></div>
        <div class="tracking-field branch"><label for="tracking-branch">Sede</label><select class="tracking-control" id="tracking-branch"><option value="">Todas</option><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div>
        <button class="tracking-apply" type="submit">Aplicar</button>
      </div>
    </form>
    <section><div class="tracking-results-head"><strong>Cotizaciones</strong><span id="tracking-result-count">0 cotizaciones</span></div><div id="tracking-results">${loadingMarkup()}</div></section>
    <footer class="tracking-footer module-footer" aria-label="Información del sistema">
      <div class="module-footer-identity"><img class="module-footer-maddy" src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte"><div class="module-footer-copy"><strong>Maderarte App</strong><span>Seguimiento comercial</span></div></div>
      <div class="module-footer-meta"><strong>Versión ${escapeHtml(APP_CONFIG.version)}</strong><span>Entorno · ${escapeHtml(environment)}</span></div>
    </footer>
  </main>
  <div class="tracking-pdf-overlay" id="tracking-pdf-overlay" aria-hidden="true">
    <section class="tracking-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="tracking-pdf-number">
      <header class="tracking-pdf-head"><div><span>Documento</span><strong id="tracking-pdf-number">Cotización</strong></div><button class="tracking-pdf-close" id="tracking-pdf-close" type="button" aria-label="Cerrar">×</button></header>
      <iframe class="tracking-pdf-frame" id="tracking-pdf-frame" title="Vista de cotización" src="about:blank"></iframe>
    </section>
  </div>`;
}

guardStandalonePage({
  permission: 'cotizaciones.read',
  async render() {
    const root = document.getElementById('tracking-app');
    renderShell(root);
    root.hidden = false;
    resetFilters();
    document.getElementById('tracking-filter-form').addEventListener('submit', event => { event.preventDefault(); filterItems(); });
    document.getElementById('tracking-reset').addEventListener('click', resetFilters);
    document.getElementById('tracking-refresh').addEventListener('click', loadQuotes);
    document.getElementById('tracking-search').addEventListener('input', filterItems);
    document.getElementById('tracking-branch').addEventListener('change', filterItems);
    document.getElementById('tracking-from').addEventListener('change', filterItems);
    document.getElementById('tracking-to').addEventListener('change', filterItems);
    document.getElementById('tracking-pdf-close').addEventListener('click', closePdf);
    document.getElementById('tracking-pdf-overlay').addEventListener('click', event => { if (event.target.id === 'tracking-pdf-overlay') closePdf(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closePdf(); });
    await loadQuotes();
  }
});
