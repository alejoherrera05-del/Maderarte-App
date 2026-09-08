import { documentHeaderMarkup, clientMarkup, footerMarkup } from './cotizacion-document-polish.js?v=family-1';
import { companyBranch } from '../core/company-profile.js';
import { escapeHtml as esc, money, date, humanizeCode } from '../core/format.js';

export async function renderReceipt(snapshot, target) {
  if (snapshot?.documentKind !== 'receipt' || snapshot.issued !== true || !snapshot.number || !snapshot.orderNumber
    || !Number.isSafeInteger(snapshot.amount) || snapshot.amount <= 0 || snapshot.previousBalance - snapshot.amount !== snapshot.balance || snapshot.balance < 0) throw Error('Recibo incompleto');
  const data = { ...snapshot, branch: companyBranch(snapshot.branchCode), date: date(snapshot.date) };
  target.innerHTML = `<section class="quote-preview-page quote-preview-main-page quote-editorial-page receipt-document">
    ${documentHeaderMarkup(data, { title: 'RECIBO DE CAJA', numberLabel: 'Número de recibo', isOrder: true })}
    <div class="quote-editorial-body">${clientMarkup(data.client)}
      <section class="quote-editorial-notes"><strong>Orden de pedido ${esc(data.orderNumber)}</strong><p>${esc(data.concept || 'Abono a la orden de pedido')}</p>${data.reference ? `<p>Referencia: ${esc(data.reference)}</p>` : ''}</section>
      <section class="receipt-document-amount"><span>Pago recibido · ${esc(humanizeCode(data.method))}</span><strong>${esc(money(data.amount))}</strong></section>
      <div class="receipt-document-balances"><p>Saldo anterior <strong>${esc(money(data.previousBalance))}</strong></p><p>Saldo después de este pago <strong>${esc(money(data.balance))}</strong></p></div>
      <p class="receipt-document-note">${data.balance === 0 ? 'Saldo de la orden cubierto a la fecha de este recibo.' : 'Este recibo corresponde al pago indicado.'} El pago no confirma una entrega.</p>
      <p class="receipt-signature">${esc(data.advisor || '')}</p>
    </div>${footerMarkup(1,1,true,Boolean(data.sandbox))}</section>`;
  if (!document.querySelector('link[data-receipt-document]')) {
    const link=document.createElement('link');link.rel='stylesheet';link.href='/css/recibo-documento.css';link.dataset.receiptDocument='true';document.head.append(link);
    await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;});
  }
  await document.fonts.ready;
  await Promise.all([...target.querySelectorAll('img')].map(img=>img.decode()));
  if (target.firstElementChild.scrollHeight > target.firstElementChild.clientHeight + 2) throw Error('El recibo excede la hoja');
  return {pages:1};
}
