import { escapeHtml } from '../core/format.js';
import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { COMMERCIAL_RULES, manufacturingWindowLabel, minimumOrderDeposit } from '../core/commercial-rules.js';

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

function optionalDetail(label, rawValue) {
  const clean = String(rawValue || '').trim();
  return clean ? `<span><b>${escapeHtml(label)}:</b> ${escapeHtml(clean)}</span>` : '';
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

function editorialHeaderMarkup(data) {
  const branch = data.branch;
  const branchName = branch?.name || text('quote-meta-branch-name') || data.branchCode || 'Maderarte';
  const branchAddress = branch?.address || '';
  const pending = /pendiente/i.test(data.number);
  const branchLine = [branchName, branchAddress].filter(Boolean).join(' · ');
  const contactTop = `WhatsApp ${COMPANY_PROFILE.whatsapp} · Cel. ${COMPANY_PROFILE.mobile}`;
  const contactBottom = [COMPANY_PROFILE.website, COMPANY_PROFILE.socialHandle].join(' · ');

  return `<header class="quote-editorial-header">
    <div class="quote-editorial-hero">
      <div class="quote-editorial-brand">
        <img class="quote-editorial-logo" src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte">
        <div class="quote-editorial-brand-copy">
          <img class="quote-editorial-wordmark" src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE">
          <span>${escapeHtml(COMPANY_PROFILE.slogan)}</span>
        </div>
      </div>

      <div class="quote-editorial-document">
        <span>COTIZACIÓN</span>
        <strong class="${pending ? 'is-pending' : ''}">${escapeHtml(data.number)}</strong>
        <div class="quote-editorial-document-meta">
          ${data.date ? `<span>${escapeHtml(data.date)}</span>` : ''}
          <span>Borrador</span>
        </div>
      </div>
    </div>

    <div class="quote-editorial-strip">
      <div class="quote-editorial-strip-cell quote-editorial-company">
        <strong>${escapeHtml(COMPANY_PROFILE.legalName)}</strong>
        <span>NIT ${escapeHtml(COMPANY_PROFILE.nit)}</span>
      </div>
      <div class="quote-editorial-strip-cell quote-editorial-branch">
        <strong>${escapeHtml(branchLine)}</strong>
        ${data.advisor ? `<span>Asesor: ${escapeHtml(data.advisor)}</span>` : ''}
      </div>
      <div class="quote-editorial-strip-cell quote-editorial-contact">
        <strong>${escapeHtml(contactTop)}</strong>
        <span>${escapeHtml(contactBottom)}</span>
      </div>
    </div>
  </header>`;
}

function clientMarkup(client) {
  const location = [client.address, client.city].filter(Boolean).join(' · ');
  const fields = [
    client.document ? `<span>Identificación<strong>${escapeHtml(client.document)}</strong></span>` : '',
    client.phone ? `<span>Teléfono<strong>${escapeHtml(client.phone)}</strong></span>` : '',
    client.email ? `<span>Correo<strong>${escapeHtml(client.email)}</strong></span>` : '',
    location ? `<span>Dirección<strong>${escapeHtml(location)}</strong></span>` : ''
  ].filter(Boolean);

  if (!client.name && !fields.length) return '';

  return `<section class="quote-editorial-client">
    <div class="quote-editorial-section-kicker">Cliente</div>
    ${client.name ? `<h3>${escapeHtml(client.name)}</h3>` : ''}
    ${fields.length ? `<div class="quote-preview-client-grid">${fields.join('')}</div>` : ''}
  </section>`;
}

function itemMarkup(item) {
  const title = item.description || item.category || `Mueble ${item.position}`;
  const details = [
    optionalDetail('Categoría', item.category),
    optionalDetail('Tela / acabado', item.fabric),
    optionalDetail('Madera / acabado', item.wood),
    optionalDetail('Especificaciones', item.specifications)
  ].filter(Boolean).join('');

  const amount = item.unitValue > 0
    ? `<div class="quote-preview-item-amount"><strong>${escapeHtml(money(item.subtotal))}</strong><span>${escapeHtml(`${item.quantity} × ${money(item.unitValue)}`)}</span></div>`
    : '';

  return `<div class="quote-preview-item">
    <div class="quote-preview-item-copy">
      <strong>${escapeHtml(`${item.position}. ${title}`)}</strong>
      ${details ? `<div class="quote-preview-item-details">${details}</div>` : ''}
    </div>
    ${amount}
  </div>`;
}

function financeMarkup(data) {
  return `<div class="quote-preview-finance">
    <div><span>Subtotal</span><strong>${escapeHtml(money(data.subtotal))}</strong></div>
    ${data.discount > 0 ? `<div><span>Descuento</span><strong>− ${escapeHtml(money(data.discount))}</strong></div>` : ''}
    <div><span>Total</span><strong>${escapeHtml(money(data.total))}</strong></div>
  </div>`;
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
      const details = [
        optionalDetail('Categoría', item.category),
        optionalDetail('Tela / acabado', item.fabric),
        optionalDetail('Madera / acabado', item.wood),
        optionalDetail('Especificaciones', item.specifications)
      ].filter(Boolean).join('');

      return `<article class="quote-appendix-item">
        <div class="quote-appendix-item-head">
          <div><span>Item ${item.position}</span><strong>${escapeHtml(title)}</strong></div>
          ${details ? `<div class="quote-preview-item-details">${details}</div>` : ''}
        </div>
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
  const minimumText = data.total > 0 ? ` (${money(data.minimumDeposit)})` : '';

  const mainPage = `<section class="quote-preview-page quote-preview-main-page quote-preview-editorial-page">
    ${editorialHeaderMarkup(data)}
    ${client}
    <div class="quote-editorial-section-heading">
      <div><span>Propuesta comercial</span><h3>Detalle de la cotización</h3></div>
      <strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong>
    </div>
    <div class="quote-preview-items">${items}</div>
    <div class="quote-preview-bottom">
      <div class="quote-preview-terms">
        <strong>Condiciones comerciales</strong>
        <p>• Para solicitar e iniciar el pedido se requiere un abono mínimo del ${COMMERCIAL_RULES.minimumOrderDepositPercent}% del valor total${escapeHtml(minimumText)}.</p>
        <p>• Tiempo estimado de fabricación: ${escapeHtml(manufacturingWindowLabel())}, contado desde la confirmación del pedido y el cumplimiento del abono mínimo.</p>
        ${data.notes ? `<p><b>Observaciones:</b> ${escapeHtml(data.notes)}</p>` : ''}
      </div>
      ${financeMarkup(data)}
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
