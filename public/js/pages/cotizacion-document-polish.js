import { escapeHtml } from '../core/format.js';
import { APP_CONFIG } from '../core/config.js';
import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { COMMERCIAL_RULES, minimumOrderDeposit } from '../core/commercial-rules.js';

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
    number: text('quote-meta-number') || 'Pendiente de asignar',
    date: compactDate(text('quote-meta-date')),
    advisor: text('quote-meta-advisor'),
    branchCode,
    branch,
    client: {
      document: value('quote-client-document'),
      name: value('quote-client-name'),
      phone: value('quote-client-phone'),
      email: value('quote-client-email'),
      address: value('quote-client-address'),
      city: value('quote-client-city')
    },
    notes: value('quote-notes'),
    items,
    subtotal,
    discount,
    total,
    minimumDeposit: minimumOrderDeposit(total)
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
        <h1>COTIZACIÓN</h1>
        <div class="quote-editorial-document-identity">
          <div class="quote-editorial-number">
            <small>N.º de cotización</small>
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
    clientField('Correo electrónico', client.email),
    clientField('Dirección / Ciudad', location, 'quote-editorial-client-field-wide')
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
  const title = item.description || item.category || `Mueble ${item.position}`;
  const facts = [itemFact(item.category), itemFact(item.fabric), itemFact(item.wood)].filter(Boolean).join('');

  return `<article class="quote-editorial-item">
    <div class="quote-editorial-item-number">${String(item.position).padStart(2, '0')}</div>
    <div class="quote-editorial-item-main">
      <div class="quote-editorial-item-title"><h3>${escapeHtml(title)}</h3></div>
      ${facts ? `<div class="quote-editorial-item-facts">${facts}</div>` : ''}
      ${item.specifications ? `<p class="quote-editorial-item-spec">${escapeHtml(item.specifications)}</p>` : ''}
    </div>
    <div class="quote-editorial-item-quantity">${escapeHtml(String(item.quantity))}</div>
    <div class="quote-editorial-item-unit">${item.unitValue > 0 ? escapeHtml(money(item.unitValue)) : '—'}</div>
    <div class="quote-editorial-item-total">${item.subtotal > 0 ? escapeHtml(money(item.subtotal)) : '—'}</div>
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
      ${data.total > 0 ? `<small>Para confirmar ${COMMERCIAL_RULES.minimumOrderDepositPercent}% · ${escapeHtml(money(data.minimumDeposit))}</small>` : ''}
    </div>
  </section>`;
}

function commercialTermsMarkup(data) {
  return `<section class="quote-editorial-terms">
    <div class="quote-editorial-section-kicker">Condiciones comerciales</div>
    <div class="quote-editorial-term-cards">
      <article class="quote-editorial-term-card quote-editorial-term-deposit">
        <div class="quote-editorial-term-icon"><img src="/assets/icons/wallet.svg" alt=""></div>
        <div class="quote-editorial-term-value">${COMMERCIAL_RULES.minimumOrderDepositPercent}%</div>
        <div class="quote-editorial-term-copy">
          <strong>Abono mínimo para confirmar</strong>
          ${data.total > 0 ? `<span>${escapeHtml(money(data.minimumDeposit))}</span>` : ''}
        </div>
      </article>
      <article class="quote-editorial-term-card quote-editorial-term-time">
        <div class="quote-editorial-term-icon"><img src="/assets/icons/calendar-dots.svg" alt=""></div>
        <div class="quote-editorial-term-value">25–30<small>días</small></div>
        <div class="quote-editorial-term-copy"><strong>Fabricación estimada</strong></div>
      </article>
    </div>
    ${data.notes ? `<div class="quote-editorial-notes"><strong>Observaciones especiales</strong><p>${escapeHtml(data.notes)}</p></div>` : ''}
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
      <span>Documento generado automáticamente · v${escapeHtml(APP_CONFIG.version)}</span>
      <span>${escapeHtml(COMPANY_PROFILE.website)} · ${escapeHtml(COMPANY_PROFILE.socialHandle)}</span>
    </div>
    <span class="quote-document-page-number">Página ${pageNumber} de ${totalPages}</span>
  </footer>`;
}

function documentDensity(data) {
  const itemText = data.items.reduce((sum, item) => sum + [
    item.description,
    item.category,
    item.fabric,
    item.wood,
    item.specifications
  ].join(' ').length, 0);
  const notesLength = String(data.notes || '').length;

  if (data.items.length <= 3 && itemText <= 1050 && notesLength <= 360) return 'relaxed';
  if (data.items.length <= 4 && itemText <= 1550 && notesLength <= 520) return 'balanced';
  return 'compact';
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

function fitMainPage() {
  const page = document.querySelector('.quote-editorial-page');
  if (!page || window.matchMedia('(max-width: 760px)').matches) return;

  const modes = ['relaxed', 'balanced', 'compact'];
  let index = modes.findIndex(mode => page.classList.contains(`quote-density-${mode}`));
  if (index < 0) index = 0;

  const fits = () => page.scrollHeight <= page.clientHeight + 2;
  while (!fits() && index < modes.length - 1) {
    page.classList.remove(`quote-density-${modes[index]}`);
    index += 1;
    page.classList.add(`quote-density-${modes[index]}`);
  }

  if (!fits()) page.classList.add('quote-density-overflow');
}

function renderDocumentPreview() {
  const data = collectDocumentData();
  const density = documentDensity(data);
  const annexPages = photoPages(data.items);
  const totalPages = 1 + annexPages.length;
  const client = clientMarkup(data.client);
  const items = data.items.map(itemMarkup).join('');

  const mainPage = `<section class="quote-preview-page quote-preview-main-page quote-editorial-page quote-density-${density}" data-page-number="1" data-page-count="${totalPages}">
    ${documentHeaderMarkup(data)}
    <div class="quote-editorial-body">
      ${client}
      <section class="quote-editorial-items-section">
        <div class="quote-editorial-section-head">
          <div><span>Mobiliario cotizado</span><h2>Detalle de productos</h2></div>
          <strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong>
        </div>
        <div class="quote-editorial-table-head" aria-hidden="true">
          <span>#</span><span>Descripción del artículo</span><span>Cant.</span><span>V. unitario</span><span>V. total</span>
        </div>
        <div class="quote-editorial-items">${items}</div>
      </section>
      <div class="quote-editorial-closing">
        ${commercialTermsMarkup(data)}
        ${investmentMarkup(data)}
      </div>
      <div class="quote-editorial-signoff">
        ${footerMarkup(1, totalPages)}
        ${signatureMarkup(data.advisor)}
      </div>
    </div>
  </section>`;

  const appendix = annexPages.map((groups, index) => appendixPageMarkup(groups, data.number, index + 2, totalPages)).join('');
  const target = document.getElementById('quote-preview-content');
  if (!target) return;
  target.innerHTML = mainPage + appendix;
  window.requestAnimationFrame(fitMainPage);
}

function openPreview() {
  renderDocumentPreview();
  const overlay = document.getElementById('quote-preview-overlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => document.getElementById('quote-preview-close')?.focus(), 120);
}

document.addEventListener('click', event => {
  const previewButton = event.target.closest('#quote-preview-button, #quote-summary-preview');
  if (!previewButton || previewButton.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPreview();
}, true);
