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

function clientDetail(label, rawValue) {
  const clean = String(rawValue || '').trim();
  return clean
    ? `<span class="quote-editorial-client-detail"><small>${escapeHtml(label)}</small><strong>${escapeHtml(clean)}</strong></span>`
    : '';
}

function clientMarkup(client) {
  const location = [client.address, client.city].filter(Boolean).join(' · ');
  const details = [
    clientDetail('CC / NIT', client.document),
    clientDetail('Tel.', client.phone),
    clientDetail('Correo', client.email),
    clientDetail('Dirección', location)
  ].filter(Boolean);

  if (!client.name && !details.length) return '';

  return `<section class="quote-editorial-client">
    <div class="quote-editorial-client-heading"><span>Preparado para</span></div>
    <div class="quote-editorial-client-copy">
      ${client.name ? `<h2>${escapeHtml(client.name)}</h2>` : ''}
      ${details.length ? `<div class="quote-editorial-client-line">${details.join('')}</div>` : ''}
    </div>
  </section>`;
}

function itemFact(label, rawValue) {
  const clean = String(rawValue || '').trim();
  return clean ? `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(clean)}</strong></span>` : '';
}

function itemMarkup(item) {
  const title = item.description || item.category || `Mueble ${item.position}`;
  const facts = [
    itemFact('Categoría', item.category),
    itemFact('Tela / acabado', item.fabric),
    itemFact('Madera / acabado', item.wood)
  ].filter(Boolean).join('');
  const quantityLabel = `${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}`;

  return `<article class="quote-editorial-item">
    <div class="quote-editorial-item-number">${String(item.position).padStart(2, '0')}</div>
    <div class="quote-editorial-item-main">
      <div class="quote-editorial-item-title">
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${facts ? `<div class="quote-editorial-item-facts">${facts}</div>` : ''}
      ${item.specifications ? `<p class="quote-editorial-item-spec">${escapeHtml(item.specifications)}</p>` : ''}
    </div>
    <div class="quote-editorial-item-price">
      <small>${escapeHtml(quantityLabel)}</small>
      ${item.unitValue > 0 ? `<strong>${escapeHtml(money(item.subtotal))}</strong>${item.quantity > 1 ? `<span>${escapeHtml(money(item.unitValue))} c/u</span>` : ''}` : ''}
    </div>
  </article>`;
}

function investmentMarkup(data) {
  const countLabel = `${data.items.length} ${data.items.length === 1 ? 'mueble incluido' : 'muebles incluidos'} en esta cotización`;
  const breakdown = data.discount > 0
    ? `<div class="quote-editorial-price-breakdown">
        <span>Subtotal <strong>${escapeHtml(money(data.subtotal))}</strong></span>
        <span>Descuento <strong>− ${escapeHtml(money(data.discount))}</strong></span>
      </div>`
    : '';

  return `<section class="quote-editorial-investment">
    <div class="quote-editorial-investment-context">
      <span>Inversión de la propuesta</span>
      <strong>${escapeHtml(countLabel)}</strong>
      <small>Valores expresados en pesos colombianos.</small>
      ${breakdown}
    </div>
    <div class="quote-editorial-total">
      <span>Total cotizado</span>
      <strong>${escapeHtml(money(data.total))}</strong>
      ${data.total > 0 ? `<small>Para confirmar: ${COMMERCIAL_RULES.minimumOrderDepositPercent}% · ${escapeHtml(money(data.minimumDeposit))}</small>` : ''}
    </div>
  </section>`;
}

function commercialTermsMarkup(data) {
  return `<section class="quote-editorial-terms">
    <div class="quote-editorial-section-kicker">Condiciones del pedido</div>
    <div class="quote-editorial-term-cards">
      <article class="quote-editorial-term-card quote-editorial-term-deposit">
        <div class="quote-editorial-term-icon"><img src="/assets/icons/wallet.svg" alt=""></div>
        <div class="quote-editorial-term-value">${COMMERCIAL_RULES.minimumOrderDepositPercent}%</div>
        <div class="quote-editorial-term-copy">
          <strong>Abono para confirmar</strong>
          <p>Activa la solicitud y el inicio del pedido.</p>
          ${data.total > 0 ? `<span>${escapeHtml(money(data.minimumDeposit))}</span>` : ''}
        </div>
      </article>
      <article class="quote-editorial-term-card quote-editorial-term-time">
        <div class="quote-editorial-term-icon"><img src="/assets/icons/calendar-dots.svg" alt=""></div>
        <div class="quote-editorial-term-value">25–30<small>días</small></div>
        <div class="quote-editorial-term-copy">
          <strong>Fabricación estimada</strong>
          <p>Desde la confirmación del pedido y el abono mínimo.</p>
        </div>
      </article>
    </div>
    ${data.notes ? `<div class="quote-editorial-notes"><strong>Observaciones</strong><p>${escapeHtml(data.notes)}</p></div>` : ''}
  </section>`;
}

function signatureMarkup(name) {
  const clean = String(name || '').trim();
  if (!clean) return '';
  return `<div class="quote-editorial-signature"><span>${escapeHtml(clean)}</span></div>`;
}

function footerMarkup() {
  return `<footer class="quote-editorial-footer">
    <img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte">
    <div class="quote-editorial-footer-copy">
      <strong>Maderarte · Sistema Maddy</strong>
      <span>Documento generado automáticamente · v${escapeHtml(APP_CONFIG.version)}</span>
      <span>${escapeHtml(COMPANY_PROFILE.website)} · ${escapeHtml(COMPANY_PROFILE.socialHandle)}</span>
    </div>
  </footer>`;
}

function appendixMarkup(items, number) {
  const withPhotos = items.filter(item => item.photos.length > 0);
  if (!withPhotos.length) return '';

  return `<section class="quote-preview-page quote-preview-appendix-page">
    <div class="quote-preview-annex-head">
      <div><span>Anexo fotográfico</span><h3>Referencias por mueble</h3></div>
      <strong>${escapeHtml(number)}</strong>
    </div>
    ${withPhotos.map(item => {
      const title = item.description || item.category || `Mueble ${item.position}`;
      return `<article class="quote-appendix-item">
        <div class="quote-appendix-item-head"><div><span>Item ${item.position}</span><strong>${escapeHtml(title)}</strong></div></div>
        <div class="quote-appendix-photos">
          ${item.photos.map((photo, index) => `<figure><img src="${escapeHtml(photo)}" alt="Referencia ${index + 1} del item ${item.position}"><figcaption>Referencia ${index + 1}</figcaption></figure>`).join('')}
        </div>
      </article>`;
    }).join('')}
  </section>`;
}

function renderDocumentPreview() {
  const data = collectDocumentData();
  const client = clientMarkup(data.client);
  const items = data.items.map(itemMarkup).join('');

  const mainPage = `<section class="quote-preview-page quote-preview-main-page quote-editorial-page">
    ${documentHeaderMarkup(data)}
    <div class="quote-editorial-body">
      ${client}
      <section class="quote-editorial-items-section">
        <div class="quote-editorial-section-head">
          <div><span>Mobiliario cotizado</span><h2>Detalle de la propuesta</h2></div>
          <strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong>
        </div>
        <div class="quote-editorial-items">${items}</div>
      </section>
      ${investmentMarkup(data)}
      ${commercialTermsMarkup(data)}
      <div class="quote-editorial-signoff">
        ${signatureMarkup(data.advisor)}
        ${footerMarkup()}
      </div>
    </div>
  </section>`;

  const target = document.getElementById('quote-preview-content');
  if (target) target.innerHTML = mainPage + appendixMarkup(data.items, data.number);
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
