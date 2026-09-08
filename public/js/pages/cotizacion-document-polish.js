import { createDocumentProgress } from '../core/order-progress.js?v=compact-1';
import { escapeHtml } from '../core/format.js';
import { paginateQuoteDocument } from '../core/quote-pagination.js';
import { COMMERCIAL_DOCUMENT } from '../core/commercial-document.js?v=agreements-1';
import { APP_CONFIG } from '../core/config.js';
import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { readFurniture, readCommercialValues } from '../core/commercial-form-values.js?v=lifecycle-1';
import { readOrderEntry } from '../core/order-entry.js?v=lifecycle-1';

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
  const item = readFurniture(card, index);
  const photos = [...card.querySelectorAll('.quote-photo-thumb img')].map(image => String(image.getAttribute('src') || '').trim()).filter(Boolean);
  return { ...item, photos };
}

function collectDocumentData() {
  const items = Array.from(document.querySelectorAll('.quote-item')).map(itemFromCard);
  const { subtotal, discount, total } = readCommercialValues();
  const order = COMMERCIAL_DOCUMENT.isOrder ? readOrderEntry(total) : null;
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
    items: items.map(item => ({ ...item, allocation: order?.allocation.find(part => part.itemId === item.itemId) || null })),
    subtotal,
    discount,
    total,
    order
  };
}

function documentHeaderMarkup(data, documentType = COMMERCIAL_DOCUMENT) {
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
        <span class="quote-editorial-eyebrow">${data.issued && documentType.isOrder ? 'Detalle de compra' : 'Propuesta comercial'}</span>
        <h1>${escapeHtml(documentType.title)}</h1>
        <div class="quote-editorial-document-identity">
          <div class="quote-editorial-number">
            <small>${escapeHtml(documentType.numberLabel)}</small>
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
      ${item.documentPlan && !item.continuation ? `<p class="order-document-agreement" data-plan="${escapeHtml(item.documentPlan.code)}">${escapeHtml(item.documentPlan.label)}</p>` : item.agreement && !item.continuation ? `<p class="order-document-agreement">${escapeHtml(item.agreement.label)}${item.fulfillment && item.agreement.code !== 'ENTREGA_HOY' ? ` · <span class="order-document-fulfillment" data-fulfillment="${item.fulfillment.code}">${escapeHtml(item.fulfillment.label)}</span>` : ''}</p>` : ''}
      ${item.specifications ? `<p class="quote-editorial-item-spec">${escapeHtml(item.specifications)}</p>` : ''}
    </div>
    <div class="quote-editorial-item-quantity">${item.continuation ? '—' : escapeHtml(String(item.quantity))}</div>
    <div class="quote-editorial-item-unit">${!item.continuation && item.unitValue > 0 ? escapeHtml(money(item.unitValue)) : '—'}</div>
    <div class="quote-editorial-item-total">${!item.continuation && item.subtotal > 0 ? escapeHtml(money(item.subtotal)) : '—'}</div>
    ${item.allocation && !item.continuation ? `<p class="order-document-allocation">${item.allocation.discount > 0 ? `Valor con descuento: ${escapeHtml(money(item.allocation.net))} · ` : ''}Abono indicado: ${escapeHtml(money(item.allocation.amount))} · Saldo: ${escapeHtml(money(item.allocation.balance))}</p>` : ''}
  </article>`;
}

function orderInvestmentMarkup(data) {
  const payments = Object.entries(data.order.payments.reduce((groups, payment) => {
    groups[payment.label] = (groups[payment.label] || 0) + payment.amount;
    return groups;
  }, {}));
  return `<section class="order-finance" aria-label="Resumen económico del pedido">
    <div class="order-finance-heading"><h2>Resumen del pedido</h2>
      <div class="order-finance-calculation"><span>Subtotal <b>${escapeHtml(money(data.subtotal))}</b></span>${data.discount > 0 ? `<span>Descuento <b>− ${escapeHtml(money(data.discount))}</b></span>` : ''}</div>
    </div>
    <dl class="order-finance-figures">
      <div class="order-finance-total"><dt>Total del pedido</dt><dd>${escapeHtml(money(data.total))}</dd></div>
      <div class="order-finance-paid"><dt>${data.issued ? 'Pagado hoy' : 'Abono indicado'}</dt><dd>${escapeHtml(money(data.order.paid))}</dd></div>
      <div class="order-finance-balance"><dt>Saldo pendiente</dt><dd>${escapeHtml(money(data.order.balance))}</dd></div>
    </dl>
    ${payments.length ? `<div class="order-finance-payments"><span>Medios de pago</span><dl>${payments.map(([method, amount]) => `<div><dt>${escapeHtml(method)}</dt><dd>${escapeHtml(money(amount))}</dd></div>`).join('')}</dl></div>` : ''}
  </section>`;
}

function investmentMarkup(data) {
  if (data.order) return orderInvestmentMarkup(data);
  const breakdown = `<div class="quote-editorial-price-breakdown">
      <span>Subtotal <strong>${escapeHtml(money(data.subtotal))}</strong></span>
      ${data.discount > 0 ? `<span>Descuento <strong>− ${escapeHtml(money(data.discount))}</strong></span>` : ''}
    </div>`;

  return `<section class="quote-editorial-investment">
    <div class="quote-editorial-investment-context">${breakdown}</div>
    <div class="quote-editorial-total">
      <span>Total cotizado</span>
      <strong>${escapeHtml(money(data.total))}</strong>

    </div>
  </section>`;
}

function commercialTermsMarkup(data) {
  const hasFactory = data.items.some(item => item.fulfillment?.code === 'PARA_SOLICITAR');
  const hasPending = data.items.some(item => item.fulfillment?.code === 'POR_DEFINIR');
  const terms = data.order
    ? `<div class="order-document-conditions">
        ${hasFactory ? `<p>${data.issued ? 'Solicitar a fábrica' : 'Muebles por solicitar'}: fabricación estimada de 25 a 30 días desde la confirmación de la solicitud.</p>` : ''}
        ${hasPending ? '<p>Los muebles por definir quedan pendientes de acordar disponibilidad y entrega.</p>' : ''}
      </div>`
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

function footerMarkup(pageNumber, totalPages, issued = false, sandbox = false) {
  return `<footer class="quote-editorial-footer quote-document-footer">
    <img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte">
    <div class="quote-editorial-footer-copy">
      <strong>Maderarte · Sistema Maddy</strong>
      <span>${sandbox ? 'PRUEBA · SIN VALIDEZ COMERCIAL' : COMMERCIAL_DOCUMENT.isOrder && !issued ? 'Borrador · sin validez comercial' : 'Documento generado automáticamente'} · v${escapeHtml(APP_CONFIG.version)}</span>
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

function appendixPageMarkup(groups, number, pageNumber, totalPages, issued = false, sandbox = false) {
  return `<section class="quote-preview-page quote-preview-appendix-page" data-page-number="${pageNumber}" data-page-count="${totalPages}" data-group-count="${groups.length}">
    <div class="quote-annex-content">
      <div class="quote-preview-annex-head">
        <div><span>Anexo fotográfico</span><h3>Referencias por mueble</h3></div>
        <strong>${escapeHtml(number)}</strong>
      </div>
      <div class="quote-appendix-groups">${groups.map(appendixGroupMarkup).join('')}</div>
    </div>
    ${footerMarkup(pageNumber, totalPages, issued, sandbox)}
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
          <div><span>${escapeHtml(COMMERCIAL_DOCUMENT.itemsLabel)}</span><h2>${data.issued && COMMERCIAL_DOCUMENT.isOrder ? 'Muebles del pedido' : 'Detalle de productos'}</h2></div>
          <strong>${data.items.length} ${data.items.length === 1 ? 'mueble' : 'muebles'}</strong>
        </div>
        <div class="quote-editorial-table-head" aria-hidden="true">
          <span>#</span><span>${data.issued && COMMERCIAL_DOCUMENT.isOrder ? 'Mueble / descripción' : 'Descripción del artículo'}</span><span>Cant.</span><span>V. unitario</span><span>V. total</span>
        </div>
        <div class="quote-editorial-items">${items}</div>
      </section>` : ''}
      ${notes}
      ${page.closing ? `<div class="${data.order ? 'order-document-closing' : 'quote-editorial-closing'}">
        ${commercialTermsMarkup({ ...data, notes: page.notes })}
        ${investmentMarkup(data)}
      </div>` : ''}
      <div class="quote-editorial-signoff">
        ${footerMarkup(pageNumber, totalPages, data.issued, data.sandbox)}
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
    // Measurement must use the same scoped document styles as the visible/printed page.
    measured.body.dataset.commercialDocument = COMMERCIAL_DOCUMENT.isOrder ? 'order' : 'quote';
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
let previewProgress = null;
async function previewImagesReady(target) {
  let timeout;
  try {
    await Promise.race([
      Promise.all([document.fonts?.ready, ...[...target.querySelectorAll('img')].map(async image => {
        await image.decode();
        if (!image.naturalWidth) throw new Error('No se cargó una imagen del documento.');
      })]),
      new Promise((_, reject) => { timeout = window.setTimeout(() => reject(new Error('Una imagen está tardando demasiado. Revisa la vista previa nuevamente.')), 8000); })
    ]);
  } finally { window.clearTimeout(timeout); }
}
async function renderDocumentPreview() {
  const generation = ++previewGeneration;
  const target = document.getElementById('quote-preview-content');
  if (!target) return;
  previewProgress ||= createDocumentProgress({ kind: COMMERCIAL_DOCUMENT.isOrder ? 'order' : 'quote', mode: 'preview' });
  const progress = previewProgress;
  progress.begin();
  progress.update({ step: 'prepare', status: 'running', message: 'Revisando muebles, acabados y valores.' });
  target.setAttribute('aria-busy', 'true');
  target.innerHTML = '<p class="quote-preview-preparing" role="status">Preparando las páginas del documento…</p>';
  try {
    // Yield a frame so the processing scene can paint before pagination work.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (generation !== previewGeneration) return;
    const data = collectDocumentData();
    progress.update({ step: 'prepare', status: 'complete' });
    progress.update({ step: 'document', status: 'running', message: 'Componiendo las páginas con el diseño de Maderarte.' });
    const pages = await measuredPages(data);
    if (generation !== previewGeneration) return;
    progress.update({ step: 'document', status: 'complete' });
    const hasPhotos = data.items.some(item => item.photos.length);
    progress.update({ step: 'photos', status: hasPhotos ? 'running' : 'skipped', message: hasPhotos ? 'Organizando las referencias de cada mueble.' : 'Sin fotografías: no hace falta un anexo.' });
    const annexPages = photoPages(data.items);
    const totalPages = pages.length + annexPages.length;
    target.innerHTML = pages.map((page, index) => mainPageMarkup(data, page, index + 1, totalPages)).join('')
      + annexPages.map((groups, index) => appendixPageMarkup(groups, data.number, pages.length + index + 1, totalPages)).join('');
    if (hasPhotos) progress.update({ step: 'photos', status: 'complete' });
    progress.update({ step: 'verify', status: 'running', message: 'Comprobando las imágenes antes de mostrar el documento.' });
    await previewImagesReady(target);
    if (generation !== previewGeneration) return;
    progress.update({ step: 'verify', status: 'complete', message: 'Vista previa lista. No se ha emitido ni guardado un documento comercial.' });
    progress.sync({ phase: 'confirmed' });
  } catch (error) {
    if (generation !== previewGeneration) return;
    progress.pause(error?.message || 'No se pudo preparar el documento.');
    target.innerHTML = `<p class="quote-preview-preparing" role="alert">${escapeHtml(error?.message || 'No se pudo preparar el documento. Cierra la vista previa e inténtalo nuevamente.')}</p>`;
  } finally {
    if (generation === previewGeneration) target.setAttribute('aria-busy', 'false');
  }
}

let previewTrigger = null;

export function openDocumentPreview() {
  const overlay = document.getElementById('quote-preview-overlay');
  if (!overlay || overlay.classList.contains('is-open')) return;
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
  previewProgress?.destroy(); previewProgress = null;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.quote-header, .quote-workspace, .quote-branch-gate').forEach(node => { node.inert = false; });
  document.body.style.overflow = '';
  if (previewTrigger?.isConnected) previewTrigger.focus({ preventScroll: true });
}

document.addEventListener('keydown', event => {
  const overlay = document.getElementById('quote-preview-overlay');
  if (document.querySelector('.order-progress-dialog[open]')) return;
  if (event.key !== 'Tab' || !overlay?.classList.contains('is-open')) return;
  // The current preview contains only one interactive control.
  event.preventDefault();
  document.getElementById('quote-preview-close')?.focus();
});


// The exact same layout/paginator serves both the approved preview and issued PDF.
// This entry point accepts only a confirmed server projection, never form DOM values.
export async function renderConfirmedOrder(snapshot, target) {
  if (!COMMERCIAL_DOCUMENT.isOrder || !target || snapshot?.issued !== true
    || !/^(?:MP|TP)-[A-Z0-9-]+-[0-9]+$/.test(snapshot.number || '')
    || !Array.isArray(snapshot.items) || !snapshot.items.length || snapshot.items.length > 100
    || !['MP', 'TP'].includes(snapshot.branchCode) || !Number.isSafeInteger(snapshot.total)) {
    throw new Error('La versión confirmada del pedido es inválida.');
  }
  if (!Number.isSafeInteger(snapshot.order?.paid) || snapshot.order.paid < 0
    || !Number.isSafeInteger(snapshot.order?.balance) || snapshot.order.balance < 0
    || snapshot.order.balance !== snapshot.total - snapshot.order.paid) {
    throw new Error('El saldo confirmado del pedido no coincide con sus importes.');
  }
  const labels = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', ADDI: 'Addi' };
  const items = snapshot.items.map((item, index) => {
    if (!Array.isArray(item.photos)) throw new Error('Faltan las referencias del mueble.');
    const photos = item.photos.map(src => {
      if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) throw new Error('Una referencia no está confirmada.');
      return src;
    });
    const plan = item.agreement === 'ENTREGA_HOY' ? { code: 'ENTREGA_INMEDIATA', label: 'Entrega inmediata' }
      : item.fulfillment === 'PARA_SOLICITAR' ? { code: 'SOLICITAR_FABRICA', label: 'Solicitar a fábrica' }
      : { code: 'SEPARADO', label: 'Separado / entregar después' };
    return { ...item, position: index + 1, itemId: item.id, photos, documentPlan: plan,
      agreement: { code: item.agreement, label: plan.label }, fulfillment: { code: item.fulfillment, label: plan.label } };
  });
  const data = { ...snapshot, items, branch: companyBranch(snapshot.branchCode),
    date: new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(snapshot.date)),
    order: { ...snapshot.order, payments: snapshot.order.payments.map(payment => {
      if (!labels[payment.method] || !Number.isSafeInteger(payment.amount)) throw new Error('El pago confirmado es inválido.');
      return { label: labels[payment.method], amount: payment.amount };
    }) }
  };
  const pages = await measuredPages(data);
  const annex = photoPages(items);
  const total = pages.length + annex.length;
  if (total > 60) throw new Error('El documento excede el límite de páginas.');
  target.innerHTML = pages.map((page, index) => mainPageMarkup(data, page, index + 1, total)).join('')
    + annex.map((groups, index) => appendixPageMarkup(groups, data.number, pages.length + index + 1, total, true, snapshot.sandbox)).join('');
  await document.fonts?.ready;
  await Promise.all([...target.querySelectorAll('img')].map(async image => {
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('No se cargó una imagen del documento.');
  }));
  for (const page of target.children) {
    if (!page.clientHeight || page.scrollHeight > page.clientHeight + 2) throw new Error('Una página no cabe en el formato aprobado.');
  }
  return { pages: total, photos: items.reduce((n, item) => n + item.photos.length, 0) };
}

// Quotation emission uses the approved preview markup and measured paginator.
export async function renderConfirmedQuote(snapshot, target) {
  if (COMMERCIAL_DOCUMENT.isOrder || !target || snapshot?.issued !== true || snapshot.documentKind !== 'quote'
    || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{4,}$/.test(snapshot.number || '')
    || !['MP','TP'].includes(snapshot.branchCode) || !Array.isArray(snapshot.items) || !snapshot.items.length || snapshot.items.length > 100
    || !Number.isSafeInteger(snapshot.subtotal) || !Number.isSafeInteger(snapshot.discount) || snapshot.discount < 0
    || !Number.isSafeInteger(snapshot.total) || snapshot.total < 0 || snapshot.total !== snapshot.subtotal - snapshot.discount) throw new Error('Cotización confirmada inválida.');
  for (const key of ['document','name','phone','email','address','city']) if (!String(snapshot.client?.[key] || '').trim()) throw new Error('Cliente incompleto.');
  const items = snapshot.items.map((item,index) => {
    if (!item.description || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unitValue) || item.unitValue < 1
      || !Number.isSafeInteger(item.subtotal) || item.subtotal !== item.quantity * item.unitValue || !Array.isArray(item.photos)) throw new Error('Mueble inválido.');
    for (const photo of item.photos) if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) throw new Error('Referencia inválida.');
    return {...item, position:index+1, itemId:item.id};
  });
  if (items.reduce((sum,item)=>sum+item.subtotal,0) !== snapshot.subtotal) throw new Error('El detalle no coincide con el total.');
  const data = {...snapshot, items, branch:companyBranch(snapshot.branchCode), order:null,
    date:new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Bogota'}).format(new Date(snapshot.date))};
  const pages = await measuredPages(data), annex = photoPages(items), total = pages.length + annex.length;
  if (total > 60) throw new Error('El documento excede el límite de páginas.');
  target.innerHTML = pages.map((page,index)=>mainPageMarkup(data,page,index+1,total)).join('')
    + annex.map((groups,index)=>appendixPageMarkup(groups,data.number,pages.length+index+1,total,true,snapshot.sandbox)).join('');
  await previewImagesReady(target);
  for (const page of target.children) if (!page.clientHeight || page.scrollHeight > page.clientHeight + 2) throw new Error('Una página no cabe en el formato aprobado.');
  return {pages:total};
}

export { documentHeaderMarkup, clientMarkup, footerMarkup };
