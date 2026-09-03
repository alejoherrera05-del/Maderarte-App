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

function iconSvg(name) {
  const paths = {
    hash: '<path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"/>',
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.5 9.5 0 0 1-3.7-.8L3 21l1.8-5.1A8.8 8.8 0 1 1 21 11.5z"/><path d="M8.2 7.8c.5 3 2.9 5.5 5.9 6.2M14.1 14c.8.2 1.5 0 2-.6M8.2 7.8c-.3.8-.1 1.6.4 2.2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    social: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M15.5 8.5h.01"/>',
    location: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
    building: '<path d="M4 21V7l8-4v18M12 9h8v12M7 10h2M7 14h2M7 18h2M15 12h2M15 16h2M2 21h20"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M17 5.5a3.5 3.5 0 0 1 0 6.5M17 14a6 6 0 0 1 5 6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/>'
  };
  return `<svg class="quote-preview-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.clipboard}</svg>`;
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

function contactItem(icon, label, content) {
  if (!content) return '';
  return `<div class="quote-premium-contact-item"><span class="quote-premium-contact-icon">${iconSvg(icon)}</span><span><small>${escapeHtml(label)}</small><strong>${escapeHtml(content)}</strong></span></div>`;
}

function premiumHeaderMarkup(data) {
  const branch = data.branch;
  const branchTitle = branch?.name || text('quote-meta-branch-name') || data.branchCode || 'Sede Maderarte';
  const branchAddress = branch?.address || '';
  const branchReference = branch?.reference || '';
  const socialText = `${COMPANY_PROFILE.socialNetworks.join(' · ')} ${COMPANY_PROFILE.socialHandle}`;
  const pending = /pendiente/i.test(data.number);

  return `<div class="quote-premium-header">
    <div class="quote-premium-brand-pane">
      <div class="quote-premium-brand-lockup">
        <img class="quote-premium-logo" src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte">
        <div class="quote-premium-brand-copy">
          <img class="quote-premium-wordmark" src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE">
          <span>${escapeHtml(COMPANY_PROFILE.slogan)}</span>
        </div>
      </div>
      <div class="quote-premium-legal">
        <strong>${escapeHtml(COMPANY_PROFILE.legalName)}</strong>
        <span>NIT ${escapeHtml(COMPANY_PROFILE.nit)}</span>
      </div>
    </div>

    <aside class="quote-premium-doc-card" aria-label="Identificación de la cotización">
      <div class="quote-premium-doc-ribbon">${iconSvg('clipboard')}<span>COTIZACIÓN</span></div>
      <div class="quote-premium-number-block">
        <span class="quote-premium-number-icon">${iconSvg('hash')}</span>
        <div><small>Número de cotización</small><strong class="${pending ? 'is-pending' : ''}">${escapeHtml(data.number)}</strong></div>
      </div>
      <div class="quote-premium-doc-bottom">
        ${data.date ? `<span class="quote-premium-date">${iconSvg('calendar')}<b>${escapeHtml(data.date)}</b></span>` : ''}
        <span class="quote-premium-status">Borrador</span>
      </div>
    </aside>
  </div>

  <div class="quote-premium-rule"><span></span><i></i></div>

  <div class="quote-premium-company-grid">
    <div class="quote-premium-contact-list">
      ${contactItem('phone', 'Celular', COMPANY_PROFILE.mobile)}
      ${contactItem('whatsapp', 'WhatsApp', COMPANY_PROFILE.whatsapp)}
      ${contactItem('globe', 'Sitio web', COMPANY_PROFILE.website)}
      ${contactItem('social', 'Redes sociales', socialText)}
    </div>
    <div class="quote-premium-branch-card">
      <span class="quote-premium-branch-icon">${iconSvg('location')}</span>
      <div><small>Sede emisora</small><strong>${escapeHtml(branchTitle)}</strong>${branchAddress ? `<span>${escapeHtml(branchAddress)}</span>` : ''}${branchReference ? `<span>${escapeHtml(branchReference)}</span>` : ''}</div>
    </div>
  </div>`;
}

function contextBandMarkup(data) {
  const cells = [];
  if (data.branch?.name || data.branchCode) cells.push({ icon: 'building', label: 'Sede emisora', value: data.branch?.name || data.branchCode });
  if (data.advisor) cells.push({ icon: 'user', label: 'Asesor', value: data.advisor });
  if (data.client.name) cells.push({ icon: 'users', label: 'Cliente', value: data.client.name });
  cells.push({ icon: 'clipboard', label: 'Estado', value: 'Borrador' });

  return `<div class="quote-premium-context-band">${cells.map(cell => `<div class="quote-premium-context-cell"><span class="quote-premium-context-icon">${iconSvg(cell.icon)}</span><span><small>${escapeHtml(cell.label)}</small><strong>${escapeHtml(cell.value)}</strong></span></div>`).join('')}</div>`;
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

  return `<div class="quote-preview-client-block">
    <div class="quote-preview-client-title"><span>Datos del cliente</span>${client.name ? `<h3>${escapeHtml(client.name)}</h3>` : ''}</div>
    ${fields.length ? `<div class="quote-preview-client-grid">${fields.join('')}</div>` : ''}
  </div>`;
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

  const mainPage = `<section class="quote-preview-page quote-preview-main-page quote-preview-premium-page">
    ${premiumHeaderMarkup(data)}
    ${contextBandMarkup(data)}
    ${client}
    <div class="quote-premium-section-heading"><div><span>Propuesta comercial</span><h3>Detalle de la cotización</h3></div><strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong></div>
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
    <footer class="quote-preview-footer">
      <span>${escapeHtml(COMPANY_PROFILE.website)} · ${escapeHtml(COMPANY_PROFILE.socialHandle)}</span>
      <span>Documento borrador · sin validez comercial</span>
    </footer>
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
