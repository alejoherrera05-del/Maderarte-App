import { escapeHtml } from '../core/format.js';
import { APP_CONFIG } from '../core/config.js';
import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';

const moneyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const money = value => moneyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
const text = value => String(value ?? '').trim();

function validate(snapshot) {
  if (!snapshot || snapshot.issued !== true || snapshot.documentKind !== 'quote'
    || typeof snapshot.number !== 'string' || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{4,}$/.test(snapshot.number)
    || !['MP', 'TP'].includes(snapshot.branchCode) || !Array.isArray(snapshot.items) || !snapshot.items.length || snapshot.items.length > 100
    || !snapshot.client || !Number.isSafeInteger(snapshot.subtotal) || !Number.isSafeInteger(snapshot.discount) || !Number.isSafeInteger(snapshot.total)
    || snapshot.total !== snapshot.subtotal - snapshot.discount) throw new Error('Cotización confirmada inválida.');
  const client = snapshot.client;
  for (const key of ['document','name','phone','email','address','city']) if (!text(client[key])) throw new Error('Cliente incompleto.');
  snapshot.items.forEach((item, index) => {
    if (!text(item.description) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unitValue) || item.unitValue < 1
      || !Number.isSafeInteger(item.subtotal) || item.subtotal !== item.quantity * item.unitValue || !Array.isArray(item.photos)) throw new Error('Mueble inválido.');
    item.position = Number.isSafeInteger(item.position) ? item.position : index + 1;
    item.photos.forEach(photo => { if (!/^data:image\/(?:png|jpeg|webp);base64,/.test(photo)) throw new Error('Referencia inválida.'); });
  });
  return snapshot;
}

function branchData(code) { return companyBranch(code) || { name: code, address: '' }; }

function header(data) {
  const branch = branchData(data.branchCode);
  return `<header class="quote-editorial-header">
    <div class="quote-editorial-letterhead">
      <div class="quote-editorial-brand">
        <div class="quote-editorial-brand-lockup"><img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte"><img src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"></div>
        <p>${escapeHtml(COMPANY_PROFILE.slogan)}</p>
      </div>
      <div class="quote-editorial-document">
        <span class="quote-editorial-eyebrow">Propuesta comercial</span><h1>COTIZACIÓN</h1>
        <div class="quote-editorial-document-identity">
          <div class="quote-editorial-number"><small>N.º de cotización</small><strong>${escapeHtml(data.number)}</strong></div>
          <div class="quote-editorial-secondary-meta">
            <span><small>Fecha</small><strong>${escapeHtml(new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Bogota'}).format(new Date(data.date)))}</strong></span>
            <span><small>Sede emisora</small><strong>${escapeHtml(branch.name || data.branchCode)}</strong></span>
          </div>
        </div>
      </div>
    </div>
    <div class="quote-editorial-company">
      <div class="quote-editorial-company-block quote-editorial-company-legal"><span class="quote-editorial-company-icon"></span><div class="quote-editorial-company-copy"><strong>${escapeHtml(COMPANY_PROFILE.legalName)}</strong><span>NIT ${escapeHtml(COMPANY_PROFILE.nit)}</span></div></div>
      <div class="quote-editorial-company-block quote-editorial-company-location"><span class="quote-editorial-company-icon"></span><div class="quote-editorial-company-copy"><span>${escapeHtml(branch.address || '')}</span></div></div>
      <div class="quote-editorial-company-block quote-editorial-company-contact"><span class="quote-editorial-company-icon"></span><div class="quote-editorial-company-copy"><span>Cel. <b>${escapeHtml(COMPANY_PROFILE.mobile)}</b></span><span>WhatsApp <b>${escapeHtml(COMPANY_PROFILE.whatsapp)}</b></span><span>${escapeHtml(COMPANY_PROFILE.website)}</span></div></div>
    </div>
  </header>`;
}

function field(label, value, extra='') { return text(value) ? `<div class="quote-editorial-client-field ${extra}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(text(value))}</strong></div>` : ''; }
function client(data) {
  const c = data.client;
  return `<section class="quote-editorial-client"><div class="quote-editorial-client-heading"><span>Información del cliente</span></div><div class="quote-editorial-client-grid">
    ${field('Cédula / NIT', c.document)}${field('Nombre completo', c.name, 'quote-editorial-client-field-name')}${field('Teléfono', c.phone)}${field('Segundo teléfono', c.alternatePhone)}${field('Correo electrónico', c.email)}${field('Dirección / Ciudad', [c.address,c.city].filter(Boolean).join(' · '), 'quote-editorial-client-field-wide')}
  </div></section>`;
}

function itemMarkup(item) {
  const facts = [item.category, item.fabric, item.wood].filter(Boolean).map(value => `<span><strong>${escapeHtml(text(value))}</strong></span>`).join('');
  return `<article class="quote-editorial-item" data-item-position="${item.position}">
    <div class="quote-editorial-item-number">${String(item.position).padStart(2,'0')}</div>
    <div class="quote-editorial-item-main"><div class="quote-editorial-item-title"><h3>${escapeHtml(item.description)}</h3></div>${facts ? `<div class="quote-editorial-item-facts">${facts}</div>` : ''}${item.specifications ? `<p class="quote-editorial-item-spec">${escapeHtml(item.specifications)}</p>` : ''}</div>
    <div class="quote-editorial-item-quantity">${item.quantity}</div><div class="quote-editorial-item-unit">${escapeHtml(money(item.unitValue))}</div><div class="quote-editorial-item-total">${escapeHtml(money(item.subtotal))}</div>
  </article>`;
}

function terms(data) {
  return `<section class="quote-editorial-terms"><div class="quote-editorial-section-kicker">Condiciones comerciales</div>
    <div class="quote-editorial-term-cards"><article class="quote-editorial-term-card quote-editorial-term-time"><div class="quote-editorial-term-icon"><img src="/assets/icons/calendar-dots.svg" alt=""></div><div class="quote-editorial-term-value">25–30<small>días</small></div><div class="quote-editorial-term-copy"><strong>Si requiere fabricación</strong></div></article></div>
    ${data.notes ? `<div class="quote-editorial-notes"><strong>Observaciones especiales</strong><p>${escapeHtml(data.notes)}</p></div>` : ''}
  </section>`;
}

function investment(data) {
  return `<section class="quote-editorial-investment"><div class="quote-editorial-investment-context"><div class="quote-editorial-price-breakdown"><span>Subtotal <strong>${escapeHtml(money(data.subtotal))}</strong></span>${data.discount > 0 ? `<span>Descuento <strong>− ${escapeHtml(money(data.discount))}</strong></span>` : ''}</div></div><div class="quote-editorial-total"><span>Total cotizado</span><strong>${escapeHtml(money(data.total))}</strong></div></section>`;
}
function signature(data) { return text(data.advisor) ? `<div class="quote-editorial-signature"><span>${escapeHtml(data.advisor)}</span></div>` : ''; }
function footer(data) {
  return `<footer class="quote-editorial-footer quote-document-footer"><img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte"><div class="quote-editorial-footer-copy"><strong>Maderarte · Sistema Maddy</strong><span>${data.sandbox ? 'PRUEBA · SIN VALIDEZ COMERCIAL' : 'Documento generado automáticamente'} · v${escapeHtml(APP_CONFIG.version)}</span><span>${escapeHtml(COMPANY_PROFILE.website)} · ${escapeHtml(COMPANY_PROFILE.socialHandle)}</span></div><span class="quote-document-page-number"></span></footer>`;
}

function pageShell(data, { first=false, closing=false } = {}) {
  const page = document.createElement('section');
  page.className = 'quote-preview-page quote-preview-main-page quote-editorial-page quote-density-relaxed';
  page.innerHTML = `${header(data)}<div class="quote-editorial-body">${first ? client(data) : ''}<section class="quote-editorial-items-section"><div class="quote-editorial-section-head"><div><span>Mobiliario cotizado</span><h2>Detalle de productos</h2></div><strong>${data.items.length} ${data.items.length === 1 ? 'mueble':'muebles'}</strong></div><div class="quote-editorial-table-head"><span>#</span><span>Descripción del artículo</span><span>Cant.</span><span>V. unitario</span><span>V. total</span></div><div class="quote-editorial-items"></div></section>${closing ? `<div class="quote-editorial-closing">${terms(data)}${investment(data)}</div>` : ''}<div class="quote-editorial-signoff">${footer(data)}${closing ? signature(data) : ''}</div></div>`;
  return page;
}
function fits(page) { return page.clientHeight > 0 && page.scrollHeight <= page.clientHeight + 2; }

function paginateItems(data, target) {
  const pages = [];
  let page = pageShell(data, { first:true, closing:false }); target.append(page); pages.push(page);
  let container = page.querySelector('.quote-editorial-items');
  data.items.forEach(item => {
    container.insertAdjacentHTML('beforeend', itemMarkup(item));
    if (!fits(page) && container.children.length > 1) {
      const last = container.lastElementChild; last.remove();
      page = pageShell(data, { first:false, closing:false }); target.append(page); pages.push(page); container = page.querySelector('.quote-editorial-items'); container.append(last);
    }
    if (!fits(page)) throw new Error('Un mueble es demasiado extenso para una página.');
  });
  const lastPage = pages.at(-1); const body = lastPage.querySelector('.quote-editorial-body');
  const closing = document.createElement('div'); closing.className = 'quote-editorial-closing'; closing.innerHTML = `${terms(data)}${investment(data)}`;
  const signoff = lastPage.querySelector('.quote-editorial-signoff'); body.insertBefore(closing, signoff); signoff.insertAdjacentHTML('beforeend', signature(data));
  if (!fits(lastPage)) {
    closing.remove(); signoff.querySelector('.quote-editorial-signature')?.remove();
    const closePage = pageShell(data, { first:false, closing:true }); closePage.querySelector('.quote-editorial-items-section')?.remove(); target.append(closePage); pages.push(closePage);
    if (!fits(closePage)) throw new Error('El cierre de la cotización excede una página.');
  }
  return pages;
}

function appendixPages(data, target) {
  const pages = [];
  for (const item of data.items.filter(item => item.photos.length)) {
    for (let offset=0; offset<item.photos.length; offset+=4) {
      const chunk = item.photos.slice(offset, offset+4);
      const page = document.createElement('section'); page.className = 'quote-preview-page quote-preview-appendix-page';
      page.innerHTML = `<div class="quote-annex-content"><div class="quote-preview-annex-head"><div><span>Anexo fotográfico</span><h3>Referencias por mueble</h3></div><strong>${escapeHtml(data.number)}</strong></div><article class="quote-appendix-group"><div class="quote-appendix-group-head"><div><span>Item ${item.position}${offset ? ' · continuación':''}</span><strong>${escapeHtml(item.description)}</strong></div><small>${chunk.length} ${chunk.length===1?'referencia':'referencias'}</small></div><div class="quote-appendix-photos" data-photo-count="${chunk.length}">${chunk.map((src,index)=>`<figure><img src="${src}" alt="Referencia ${offset+index+1} del item ${item.position}"><figcaption>Referencia ${offset+index+1}</figcaption></figure>`).join('')}</div></article></div>${footer(data)}`;
      target.append(page); pages.push(page); if (!fits(page)) throw new Error('El anexo fotográfico excede la página.');
    }
  }
  return pages;
}

async function render(snapshot, target) {
  const data = validate(snapshot);
  target.replaceChildren();
  await document.fonts?.ready;
  const pages = paginateItems(data, target).concat(appendixPages(data, target));
  await Promise.all([...target.querySelectorAll('img')].map(async image => { await image.decode(); if (!image.naturalWidth) throw new Error('No se cargó una imagen.'); }));
  pages.forEach((page,index) => { page.dataset.pageNumber = String(index+1); page.dataset.pageCount = String(pages.length); page.querySelector('.quote-document-page-number').textContent = `Página ${index+1} de ${pages.length}`; if (!fits(page)) throw new Error('Una página no cabe en el formato aprobado.'); });
  return { pages: pages.length };
}

let started = false;
async function consume() {
  const node = document.getElementById('maddy-document-data');
  if (started || !node || node.type !== 'application/json') return;
  started = true;
  const target = document.getElementById('quote-preview-content');
  try {
    const snapshot = JSON.parse(node.textContent); node.remove();
    const result = await render(snapshot, target);
    target.dataset.documentPages = String(result.pages);
    target.dataset.documentReady = 'true';
  } catch {
    target.replaceChildren(); target.dataset.documentError = 'true';
  }
}
new MutationObserver(() => { void consume(); }).observe(document.documentElement, { childList:true, subtree:true });
void consume();
