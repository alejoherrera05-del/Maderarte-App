import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { APP_CONFIG } from '../core/config.js';
import { escapeHtml as esc, money, date, humanizeCode } from '../core/format.js';

const field=(label,value,extra='')=>value?`<div class="receipt-document-field ${extra}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';
export async function renderReceipt(snapshot, target) {
  if (snapshot?.documentKind !== 'receipt' || snapshot.issued !== true || !snapshot.number || !snapshot.orderNumber
    || !Number.isSafeInteger(snapshot.amount) || snapshot.amount <= 0 || snapshot.previousBalance - snapshot.amount !== snapshot.balance || snapshot.balance < 0) throw Error('Recibo incompleto');
  if (!document.querySelector('link[data-receipt-document]')) {
    await new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/css/recibo-documento.css?v=half-letter-1';link.dataset.receiptDocument='true';link.onload=resolve;link.onerror=reject;document.head.append(link);});
  }
  const r=snapshot,c=r.client||{},branch=companyBranch(r.branchCode),company=COMPANY_PROFILE;
  target.innerHTML=`<section class="receipt-document">
    <header class="receipt-document-header"><div class="receipt-document-brand"><div><img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte"><img src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"></div><p>${esc(company.slogan)}</p></div><div class="receipt-document-identity"><h1>RECIBO DE CAJA</h1><strong>${esc(r.number)}</strong><p>${esc(date(r.date))} · ${esc(branch?.displayName||r.branchCode)}</p></div></header>
    <div class="receipt-document-company"><p>${esc(company.legalName)} · NIT ${esc(company.nit)}</p><p>${esc(branch?.address||'')} · Cel. ${esc(company.mobile)} · WhatsApp ${esc(company.whatsapp)}</p></div>
    ${r.sandbox?'<p class="receipt-document-sample">MUESTRA · SIN VALIDEZ COMERCIAL</p>':''}
    <section class="receipt-document-client">${field('Recibido de',c.name,'receipt-document-client-name')}${field('Cédula / NIT',c.document)}${field('Teléfono',[c.phone,c.alternatePhone].filter(Boolean).join(' / '))}${field('Dirección',[c.address,c.city].filter(Boolean).join(' · '),'receipt-document-client-address')}${field('Correo',c.email)}</section>
    <div class="receipt-document-payment"><section class="receipt-document-concept"><span>Concepto · Orden ${esc(r.orderNumber)}</span><p>${esc(r.concept||'Abono a la orden de pedido')}</p>${r.reference?`<p class="receipt-document-reference">Referencia: ${esc(r.reference)}</p>`:''}</section><section class="receipt-document-totals"><div class="receipt-document-amount"><span>Valor recibido · ${esc(humanizeCode(r.method))}</span><strong>${esc(money(r.amount))}</strong></div><p>Saldo anterior <strong>${esc(money(r.previousBalance))}</strong></p><p>Nuevo saldo <strong>${esc(money(r.balance))}</strong></p></section></div>
    <div class="receipt-document-closing"><p>${r.balance===0?'Saldo de la orden cubierto.':'Este recibo corresponde al pago indicado.'} El pago no confirma una entrega.</p><div class="receipt-signature">${esc(r.advisor||'')}</div></div>
    <footer class="receipt-document-footer"><img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte"><span>${esc(company.website)} · ${esc(company.socialHandle)}</span><span>Maddy · v${esc(APP_CONFIG.version)} · 1 / 1</span></footer>
  </section>`;
  await document.fonts.ready;
  await Promise.all([...target.querySelectorAll('img')].map(img=>img.decode()));
  const page=target.firstElementChild;
  if(page.scrollHeight>page.clientHeight+2 || page.scrollWidth>page.clientWidth+2)throw Error('El recibo excede la hoja');
  return {pages:1};
}
