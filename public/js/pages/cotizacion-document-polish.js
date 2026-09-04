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
    date: text('quote-meta-date'),
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
        <span class="quote-editorial-eyebrow">Documento comercial</span>
        <h1>COTIZACIÓN</h1>
        <div class="quote-editorial-meta">
          <span><small>N.º</small><strong>${escapeHtml(data.number)}</strong></span>
          <span><small>Fecha</small><strong>${escapeHtml(data.date || '—')}</strong></span>
          <span><small>Sede</small><strong>${escapeHtml(branchName)}</strong></span>
        </div>
      </div>
    </div>

    <div class="quote-editorial-company">
      <span class="quote-editorial-company-legal"><strong>${escapeHtml(COMPANY_PROFILE.legalName)}</strong> · NIT ${escapeHtml(COMPANY_PROFILE.nit)}</span>
      ${branchLocation ? `<span>${escapeHtml(branchLocation)}</span>` : ''}
      <span>WhatsApp ${escapeHtml(COMPANY_PROFILE.whatsapp)} · ${escapeHtml(COMPANY_PROFILE.website)} · ${escapeHtml(COMPANY_PROFILE.socialHandle)}</span>
    </div>
  </header>`;
}

function clientMarkup(client) {
  const location = [client.address, client.city].filter(Boolean).join(' · ');
  const details = [client.document, client.phone, client.email, location].filter(Boolean);
  if (!client.name && !details.length) return '';

  return `<section class="quote-editorial-client">
    <div class="quote-editorial-marker">Preparado para</div>
    <div class="quote-editorial-client-copy">
      ${client.name ? `<h2>${escapeHtml(client.name)}</h2>` : ''}
      ${details.length ? `<div class="quote-editorial-client-line">${details.map(detail => `<span>${escapeHtml(detail)}</span>`).join('')}</div>` : ''}
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

  return `<article class="quote-editorial-item">
    <div class="quote-editorial-item-number">${String(item.position).padStart(2, '0')}</div>
    <div class="quote-editorial-item-main">
      <div class="quote-editorial-item-title">
        <h3>${escapeHtml(title)}</h3>
        <span>${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}</span>
      </div>
      ${facts ? `<div class="quote-editorial-item-facts">${facts}</div>` : ''}
      ${item.specifications ? `<p class="quote-editorial-item-spec">${escapeHtml(item.specifications)}</p>` : ''}
    </div>
    ${item.unitValue > 0 ? `<div class="quote-editorial-item-price"><small>Total ítem</small><strong>${escapeHtml(money(item.subtotal))}</strong>${item.quantity > 1 ? `<span>${escapeHtml(money(item.unitValue))} c/u</span>` : ''}</div>` : ''}
  </article>`;
}

function investmentMarkup(data) {
  const balance = Math.max(0, data.total - data.minimumDeposit);
  return `<section class="quote-editorial-investment">
    <div class="quote-editorial-summary-lines">
      <div><span>Subtotal</span><strong>${escapeHtml(money(data.subtotal))}</strong></div>
      ${data.discount > 0 ? `<div><span>Descuento</span><strong>− ${escapeHtml(money(data.discount))}</strong></div>` : ''}
      ${data.total > 0 ? `<div><span>Anticipo para confirmar</span><strong>${escapeHtml(money(data.minimumDeposit))}</strong></div>` : ''}
      ${data.total > 0 ? `<div><span>Saldo posterior</span><strong>${escapeHtml(money(balance))}</strong></div>` : ''}
    </div>
    <div class="quote-editorial-total">
      <span>Total cotizado</span>
      <strong>${escapeHtml(money(data.total))}</strong>
    </div>
  </section>`;
}

function commercialTermsMarkup(data) {
  return `<section class="quote-editorial-terms">
    <div class="quote-editorial-section-kicker">Condiciones clave</div>
    <div class="quote-editorial-term-row">
      <span class="quote-editorial-term-index">01</span>
      <div><strong>Confirmación del pedido</strong><p>El pedido entra a producción con un anticipo mínimo del ${COMMERCIAL_RULES.minimumOrderDepositPercent}%.</p></div>
      <b>${COMMERCIAL_RULES.minimumOrderDepositPercent}%${data.total > 0 ? ` · ${escapeHtml(money(data.minimumDeposit))}` : ''}</b>
    </div>
    <div class="quote-editorial-term-row">
      <span class="quote-editorial-term-index">02</span>
      <div><strong>Fabricación estimada</strong><p>El tiempo se cuenta desde la confirmación y el cumplimiento del anticipo.</p></div>
      <b>25–30 días</b>
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
    <div>
      <strong>Maderarte · ${escapeHtml(COMPANY_PROFILE.slogan)}</strong>
      <span>Documento generado automáticamente · Sistema Maddy v${escapeHtml(APP_CONFIG.version)}</span>
    </div>
    <span class="quote-editorial-footer-social">${escapeHtml(COMPANY_PROFILE.socialHandle)}</span>
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
          <div><span>Mobiliario cotizado</span><h2>Detalle de inversión</h2></div>
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
