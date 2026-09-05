import { escapeHtml } from '../core/format.js';
import { paginateQuoteDocument } from '../core/quote-pagination.js';
import { COMMERCIAL_DOCUMENT } from '../core/commercial-document.js?v=payments-1';
import { APP_CONFIG } from '../core/config.js';
import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { readOrderEntry } from '../core/order-entry.js?v=payments-1';

function ensureEditorialStyles() {
  if (document.querySelector('link[data-quote-editorial]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/cotizacion-document-editorial.css';
  link.dataset.quoteEditorial = 'true';
  document.head.appendChild(link);
}

ensureEditorialStyles();

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

function money(value) {
  const number = Number(value);
  return moneyFormatter.format(Number.isFinite(number) ? number : 0);
}

function parseMoney(value) {
  return Number(String(value || '').replace(/[^0-9]/g, '') || 0);
}

function value(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function text(id) {
  return document.getElementById(id)?.textContent?.trim() || '';
}

function compactDate(rawValue) {
  return String(rawValue || '')
    .trim()
    .replace(/\s+de\s+/gi, ' ')
    .replace(/septiembre/gi, 'sept')
    .replace(/setiembre/gi, 'sept')
    .replace(/\s{2,}/g, ' ');
}

function itemFromCard(card, index) {
  const field = name => card.querySelector(`[data-field="${name}"]`)?.value?.trim() || '';
  const quantity = Math.max(1, Number(field('quantity') || 1));
  const unitValue = parseMoney(field('unitValue'));
  const photos = Array.from(card.querySelectorAll('.quote-photo-thumb img'))
    .map(image => String(image.getAttribute('src') || '').trim())
    .filter(Boolean);

  return {
    position: index + 1,
    description: field('description'),
    category: field('category'),
    quantity,
    fabric: field('fabric'),
    wood: field('wood'),
    specifications: field('specifications'),
    unitValue,
    subtotal: quantity * unitValue,
    photos
  };
}

function collectDocumentData() {
  const items = Array.from(document.querySelectorAll('.quote-item')).map(itemFromCard);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Math.min(subtotal, parseMoney(value('quote-discount')));
  const total = Math.max(0, subtotal - discount);
  const branchCode = text('quote-meta-branch').toUpperCase();
  const branch = companyBranch(branchCode);

  return {
    number: text('quote-meta-number') || COMMERCIAL_DOCUMENT.pendingNumber,
    date: compactDate(text('quote-meta-date')),
    advisor: text('quote-meta-advisor'),
    branchCode,
    branch,
    client: {
      document: value('quote-client-document'),
      name: value('quote-client-name'),
      phone: value('quote-client-phone'),
      alternatePhone: value('quote-client-alternatePhone'),
      email: value('quote-client-email'),
      address: value('quote-client-address'),
      city: value('quote-client-city')
    },
    notes: value('quote-notes'),
    items,
    subtotal,
    discount,
    total,
    order: COMMERCIAL_DOCUMENT.isOrder ? readOrderEntry(total) : null
  };
}

function documentHeaderMarkup(data) {
  const branch = data.branch;
  const branchName = branch?.name || text('quote-meta-branch-name') || data.branchCode || 'Maderarte';
  const branchAddress = branch?.address || '';
  const branchReference = branch?.reference || '';
  const branchLocation = [branchAddress, branchReference].filter(Boolean).join(' · ');

  return `<header class="quote-editorial-header">
    <div class="quote-editorial-letterhead">
      <div class="quote-editorial-brand">
        <div class="quote-editorial-brand-lockup">
          <img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte">
          <img src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE">
        </div>
        <p>${escapeHtml(COMPANY_PROFILE.slogan)}</p>
      </div>

      <div class="quote-editorial-document">
        <span class="quote-editorial-eyebrow">Propuesta comercial</span>
        <h1>${escapeHtml(COMMERCIAL_DOCUMENT.title)}</h1>
        <div class="quote-editorial-document-identity">
          <div class="quote-editorial-number">
            <small>${escapeHtml(COMMERCIAL_DOCUMENT.numberLabel)}</small>
            <strong>${escapeHtml(data.number)}</strong>
          </div>
          <div class="quote-editorial-secondary-meta">
            <span><small>Fecha</small><strong>${escapeHtml(data.date || '—')}</strong></span>
            <span><small>Sede emisora</small><strong>${escapeHtml(branchName)}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <div class="quote-editorial-company">
      <div class="quote-editorial-company-block quote-editorial-company-legal">
        <span class="quote-editorial-company-icon" aria-hidden="true"></span>
        <div class="quote-editorial-company-copy">
          <strong>${escapeHtml(COMPANY_PROFILE.legalName)}</strong>
          <span>NIT ${escapeHtml(COMPANY_PROFILE.nit)}</span>
        </div>
      </div>
      ${branchLocation ? `<div class="quote-editorial-company-block quote-editorial-company-location">
        <span class="quote-editorial-company-icon" aria-hidden="true"></span>
        <div class="quote-editorial-company-copy"><span>${escapeHtml(branchLocation)}</span></div>
      </div>` : ''}
      <div class="quote-editorial-company-block quote-editorial-company-contact">
        <span class="quote-editorial-company-icon" aria-hidden="true"></span>
        <div class="quote-editorial-company-copy">
          <span>Cel. <b>${escapeHtml(COMPANY_PROFILE.mobile)}</b></span>
          <span>WhatsApp <b>${escapeHtml(COMPANY_PROFILE.whatsapp)}</b></span>
          <span>${escapeHtml(COMPANY_PROFILE.website)}</span>
        </div>
      </div>
    </div>
  </header>`;
}

function clientField(label, rawValue, className = '') {
  const clean = String(rawValue || '').trim();
  return clean
    ? `<div class="quote-editorial-client-field ${className}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(clean)}</strong></div>`
    : '';
}

function clientMarkup(client) {
  const location = [client.address, client.city].filter(Boolean).join(' · ');
  const fields = [
    clientField('Cédula / NIT', client.document),
    clientField('Nombre completo', client.name, 'quote-editorial-client-field-name'),
    clientField('Teléfono', client.phone),
    clientField('Segundo teléfono', client.alternatePhone),
    clientField('Correo electrónico', client.email),
    clientField(COMMERCIAL_DOCUMENT.addressLabel, location, 'quote-editorial-client-field-wide')
  ].filter(Boolean);

  if (!fields.length) return '';

  return `<section class="quote-editorial-client">
    <div class="quote-editorial-client-heading"><span>Información del cliente</span></div>
    <div class="quote-editorial-client-grid">${fields.join('')}</div>
  </section>`;
}

function itemFact(rawValue) {
  const clean = String(rawValue || '').trim();
  return clean ? `<span><strong>${escapeHtml(clean)}</strong></span>` : '';
}

function itemMarkup(item) {
  const title = item.description || item.category || `Mueble ${item.position}${item.continuation ? ' · continuación' : ''}`;
  const facts = [itemFact(item.category), itemFact(item.fabric), itemFact(item.wood)].filter(Boolean).join('');

  return `<article class="quote-editorial-item" data-item-position="${item.position}" data-continuation="${Boolean(item.continuation)}">
    <div class="quote-editorial-item-number">${String(item.position).padStart(2, '0')}${item.continuation ? ' ↳' : ''}</div>
    <div class="quote-editorial-item-main">
      <div class="quote-editorial-item-title"><h3>${escapeHtml(title)}</h3></div>
      ${facts ? `<div class="quote-editorial-item-facts">${facts}</div>` : ''}
      ${item.specifications ? `<p class="quote-editorial-item-spec">${escapeHtml(item.specifications)}</p>` : ''}
    </div>
    <div class="quote-editorial-item-quantity">${item.continuation ? '—' : escapeHtml(String(item.quantity))}</div>
    <div class="quote-editorial-item-unit">${!item.continuation && item.unitValue > 0 ? escapeHtml(money(item.unitValue)) : '—'}</div>
    <div class="quote-editorial-item-total">${!item.continuation && item.subtotal > 0 ? escapeHtml(money(item.subtotal)) : '—'}</div>
  </article>`;
}

function investmentMarkup(data) {
  const breakdown = `<div class="quote-editorial-price-breakdown">
      <span>Subtotal <strong>${escapeHtml(money(data.subtotal))}</strong></span>
      ${data.discount > 0 ? `<span>Descuento <strong>− ${escapeHtml(money(data.discount))}</strong></span>` : ''}
    </div>`;

  return `<section class="quote-editorial-investment">
    <div class="quote-editorial-investment-context">${breakdown}</div>
    <div class="quote-editorial-total">
      <span>Total</span>
      <strong>${escapeHtml(money(data.total))}</strong>

    </div>
    ${data.order ? `<div class="order-document-payments">
      ${Object.entries(data.order.payments.reduce((groups, payment) => { groups[payment.label] = (groups[payment.label] || 0) + payment.amount; return groups; }, {})).map(([method, amount]) => `<div><span>${escapeHtml(method)}</span><strong>${escapeHtml(money(amount))}</strong></div>`).join('')}
      <div><span>Abono indicado</span><strong>${escapeHtml(money(data.order.paid))}</strong></div>
      <div class="order-document-balance"><span>Saldo por pagar</span><strong>${escapeHtml(money(data.order.balance))}</strong></div>
    </div>` : ''}
  </section>`;
}

function commercialTermsMarkup(data) {
  const mode = data.order?.saleMode;
  const terms = mode
    ? `<article class="order-document-mode"><strong>${escapeHtml(mode.label)}</strong><p>${escapeHtml(mode.terms)}</p></article>`
    : `<div class="quote-editorial-term-cards"><article class="quote-editorial-term-card quote-editorial-term-time">
        <div class="quote-editorial-term-icon"><img src="/assets/icons/calendar-dots.svg" alt=""></div>
        <div class="quote-editorial-term-value">25–30<small>días</small></div>
        <div class="quote-editorial-term-copy"><strong>Si requiere fabricación</strong></div>
      </article></div>`;
  return `<section class="quote-editorial-terms">
    <div class="quote-editorial-section-kicker">Condiciones comerciales</div>
    ${terms}
    ${data.notes ? `<div class="quote-editorial-notes"><strong>${escapeHtml(COMMERCIAL_DOCUMENT.notesLabel)}</strong><p>${escapeHtml(data.notes)}</p></div>` : ''}
  </section>`;
}

function signatureMarkup(name) {
  const clean = String(name || '').trim();
  if (!clean) return '';
  return `<div class="quote-editorial-signature"><span>${escapeHtml(clean)}</span></div>`;
}

function footerMarkup(pageNumber, totalPages) {
  return `<footer class="quote-editorial-footer quote-document-footer">
    <img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte">
    <div class="quote-editorial-footer-copy">
      <strong>Maderarte · Sistema Maddy</strong>
      <span>${COMMERCIAL_DOCUMENT.isOrder ? 'Borrador · sin validez comercial' : 'Documento generado automáticamente'} · v${escapeHtml(APP_CONFIG.version)}</span>
      <span>${escapeHtml(COMPANY_PROFILE.website)} · ${escapeHtml(COMPANY_PROFILE.socialHandle)}</span>
    </div>
    <span class="quote-document-page-number">Página ${pageNumber} de ${totalPages}</span>
  </footer>`;
}

function photoGroups(items) {
  const groups = [];
  items.filter(item => item.photos.length > 0).forEach(item => {
    for (let index = 0; index < item.photos.length; index += 4) {
      groups.push({
        item,
        photos: item.photos.slice(index, index + 4),
        continuation: index > 0,
        groupIndex: Math.floor(index / 4) + 1
      });
    }
  });
  return groups;
}

function photoPages(items) {
  const groups = photoGroups(items);
  const pages = [];
  let current = [];
  let usedSlots = 0;

  groups.forEach(group => {
    const cost = group.photos.length === 1 ? 1 : 2;
    if (current.length && usedSlots + cost > 2) {
      pages.push(current);
      current = [];
      usedSlots = 0;
    }
    current.push(group);
    usedSlots += cost;
    if (usedSlots >= 2) {
      pages.push(current);
      current = [];
      usedSlots = 0;
    }
  });

  if (current.length) pages.push(current);
  return pages;
}

function appendixGroupMarkup(group) {
  const item = group.item;
  const title = item.description || item.category || `Mueble ${item.position}`;
  const continuationLabel = group.continuation ? ` · continuación ${group.groupIndex}` : '';

  return `<article class="quote-appendix-group">
    <div class="quote-appendix-group-head">
      <div>
        <span>Item ${item.position}${continuationLabel}</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <small>${group.photos.length} ${group.photos.length === 1 ? 'referencia' : 'referencias'}</small>
    </div>
    <div class="quote-appendix-photos" data-photo-count="${group.photos.length}">
      ${group.photos.map((photo, index) => `<figure><img src="${escapeHtml(photo)}" alt="Referencia ${index + 1} del item ${item.position}"><figcaption>Referencia ${index + 1}</figcaption></figure>`).join('')}
    </div>
  </article>`;
}

function appendixPageMarkup(groups, number, pageNumber, totalPages) {
  return `<section class="quote-preview-page quote-preview-appendix-page" data-page-number="${pageNumber}" data-page-count="${totalPages}" data-group-count="${groups.length}">
    <div class="quote-annex-content">
      <div class="quote-preview-annex-head">
        <div><span>Anexo fotográfico</span><h3>Referencias por mueble</h3></div>
        <strong>${escapeHtml(number)}</strong>
      </div>
      <div class="quote-appendix-groups">${groups.map(appendixGroupMarkup).join('')}</div>
    </div>
    ${footerMarkup(pageNumber, totalPages)}
  </section>`;
}

function mainPageMarkup(data, page, pageNumber = 1, totalPages = 1) {
  const client = page.client ? clientMarkup(data.client) : '';
  const items = page.items.map(itemMarkup).join('');
  const notes = page.notes && !page.closing ? `<section class="quote-editorial-notes quote-editorial-notes-page"><strong>${escapeHtml(COMMERCIAL_DOCUMENT.notesLabel)}</strong><p>${escapeHtml(page.notes)}</p></section>` : '';
  return `<section class="quote-preview-page quote-preview-main-page quote-editorial-page quote-density-relaxed${COMMERCIAL_DOCUMENT.isOrder ? ' order-document-page' : ''}${page.closing ? '' : ' quote-continuation-page'}" data-page-number="${pageNumber}" data-page-count="${totalPages}">
    ${documentHeaderMarkup(data)}
    <div class="quote-editorial-body">
      ${client}
      ${page.items.length ? `<section class="quote-editorial-items-section">
        <div class="quote-editorial-section-head">
          <div><span>${escapeHtml(COMMERCIAL_DOCUMENT.itemsLabel)}</span><h2>Detalle de productos</h2></div>
          <strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong>
        </div>
        <div class="quote-editorial-table-head" aria-hidden="true">
          <span>#</span><span>Descripción del artículo</span><span>Cant.</span><span>V. unitario</span><span>V. total</span>
        </div>
        <div class="quote-editorial-items">${items}</div>
      </section>` : ''}
      ${notes}
      ${page.closing ? `<div class="quote-editorial-closing">
        ${commercialTermsMarkup({ ...data, notes: page.notes })}
        ${investmentMarkup(data)}
      </div>` : ''}
      <div class="quote-editorial-signoff">
        ${footerMarkup(pageNumber, totalPages)}
        ${page.closing ? signatureMarkup(data.advisor) : ''}
      </div>
    </div>
  </section>`;
}

async function measuredPages(data) {
  const frame = document.createElement('iframe');
  frame.className = 'quote-pagination-measure';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Preparación del documento';
  document.body.appendChild(frame);
  let timeout;
  try {
    const measured = frame.contentDocument;
    measured.documentElement.lang = 'es';
    measured.body.className = 'quote-page';
    const ready = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(source => {
      const link = measured.createElement('link');
      link.rel = 'stylesheet';
      link.href = source.href;
      ready.push(new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; }));
      measured.head.appendChild(link);
    });
    const root = measured.createElement('div');
    root.id = 'quote-preview-content';
    measured.body.appendChild(root);
    root.innerHTML = mainPageMarkup(data, { client: true, items: [], closing: true, notes: '' });
    ready.push(...Array.from(measured.images).map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })));
    await Promise.race([
      Promise.all(ready).then(() => measured.fonts?.ready),
      new Promise((_, reject) => { timeout = window.setTimeout(() => reject(new Error('No se cargó el documento a tiempo. Intenta abrir la vista previa nuevamente.')), 8000); })
    ]);
    return paginateQuoteDocument(data, page => {
      root.innerHTML = mainPageMarkup(data, page);
      const element = root.firstElementChild;
      return element.clientHeight > 0 && element.scrollHeight <= element.clientHeight + 1;
    });
  } finally {
    window.clearTimeout(timeout);
    frame.remove();
  }
}

let previewGeneration = 0;
async function renderDocumentPreview() {
  const generation = ++previewGeneration;
  const target = document.getElementById('quote-preview-content');
  if (!target) return;
  target.setAttribute('aria-busy', 'true');
  target.innerHTML = '<p class="quote-preview-preparing" role="status">Preparando las páginas del documento…</p>';
  try {
    const data = collectDocumentData();
    const pages = await measuredPages(data);
    if (generation !== previewGeneration) return;
    const annexPages = photoPages(data.items);
    const totalPages = pages.length + annexPages.length;
    target.innerHTML = pages.map((page, index) => mainPageMarkup(data, page, index + 1, totalPages)).join('')
      + annexPages.map((groups, index) => appendixPageMarkup(groups, data.number, pages.length + index + 1, totalPages)).join('');
  } catch (error) {
    if (generation !== previewGeneration) return;
    target.innerHTML = `<p class="quote-preview-preparing" role="alert">${escapeHtml(error?.message || 'No se pudo preparar el documento. Cierra la vista previa e inténtalo nuevamente.')}</p>`;
  } finally {
    if (generation === previewGeneration) target.setAttribute('aria-busy', 'false');
  }
}

let previewTrigger = null;

export function openDocumentPreview() {
  const overlay = document.getElementById('quote-preview-overlay');
  if (!overlay) return;
  previewTrigger = document.activeElement;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.querySelectorAll('.quote-header, .quote-workspace, .quote-branch-gate').forEach(node => { node.inert = true; });
  document.body.style.overflow = 'hidden';
  document.getElementById('quote-preview-close')?.focus();
  void renderDocumentPreview();
}

export function closeDocumentPreview() {
  const overlay = document.getElementById('quote-preview-overlay');
  if (!overlay?.classList.contains('is-open')) return;
  ++previewGeneration;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.quote-header, .quote-workspace, .quote-branch-gate').forEach(node => { node.inert = false; });
  document.body.style.overflow = '';
  if (previewTrigger?.isConnected) previewTrigger.focus({ preventScroll: true });
}

document.addEventListener('keydown', event => {
  const overlay = document.getElementById('quote-preview-overlay');
  if (event.key !== 'Tab' || !overlay?.classList.contains('is-open')) return;
  // The current preview contains only one interactive control.
  event.preventDefault();
  document.getElementById('quote-preview-close')?.focus();
});
