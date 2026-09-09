import { COMPANY_PROFILE, companyBranch } from '../core/company-profile.js';
import { APP_CONFIG } from '../core/config.js';
import { escapeHtml as esc, dateTime } from '../core/format.js';
const field=(label,value)=>`<div><span>${esc(label)}</span><p>${esc(value||'—')}</p></div>`;
export async function renderRemission(r,target){
  if(r?.documentKind!=='remission'||r.issued!==true||!r.number||!r.orderNumber||!r.transporter?.name||!r.dispatcher||!Array.isArray(r.items)||!r.items.length||r.items.some(i=>!i.itemId||!i.description||!Number.isSafeInteger(i.quantity)||i.quantity<=0||!Number.isSafeInteger(i.pendingAfter)||i.pendingAfter<0))throw Error('Remisión incompleta');
  if(!document.querySelector('link[data-remission-document]'))await new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/css/remision-documento.css';link.dataset.remissionDocument='true';link.onload=resolve;link.onerror=reject;document.head.append(link);});
  const company=COMPANY_PROFILE,branch=companyBranch(r.branchCode),c=r.client||{};
  target.replaceChildren();
  const makePage=()=>{
    const page=document.createElement('section');page.className='rm-document';
    page.innerHTML=`<header class="rm-doc-header"><div class="rm-doc-brand"><div><img src="/assets/brand/maderarte-logo-2026.webp" alt="Maderarte"><img src="/assets/brand/maderarte-wordmark-algerian.png" alt="MADERARTE"></div><p>${esc(company.slogan)}</p></div><div class="rm-doc-identity"><h1>REMISIÓN</h1><strong>${esc(r.number)}</strong><p>${esc(dateTime(r.date))} · ${esc(branch?.displayName||r.branchCode)}</p></div></header>
      <div class="rm-doc-company"><span>${esc(company.legalName)} · NIT ${esc(company.nit)}</span><span>${esc(branch?.address||'')} · Cel. ${esc(company.mobile)}</span></div>
      ${r.sandbox?'<p class="rm-doc-sample">MUESTRA · SIN VALIDEZ COMERCIAL · SIN ENTREGA REAL</p>':''}
      <section class="rm-doc-client">${field('Cliente',c.name)}${field('Cédula / NIT',c.document)}${field('Orden de pedido',r.orderNumber)}${field('Dirección de entrega',c.address)}${field('Ciudad',c.city)}${field('Teléfonos',[c.phone,c.alternatePhone].filter(Boolean).join(' / '))}</section>
      <div class="rm-doc-body"></div>
      <section class="rm-doc-staff">${field('Despacha',r.dispatcher)}${field(r.transporter.mode==='PIALLERO'?'Transporta · piallero':r.transporter.mode==='PROPIETARIO'?'Transporta · propietario':'Transporta',r.transporter.name)}${field('Operario acompañante',r.assistant||'Solo el transportador')}</section>
      <div class="rm-doc-signature"><span>Firma de quien despacha</span><span>Salida del almacén · recepción en destino pendiente de constancia</span></div>
      <footer class="rm-doc-footer"><img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte"><span>${esc(company.website)} · ${esc(company.socialHandle)}</span><span class="rm-doc-page-number"></span></footer>`;
    target.append(page);return page;
  };
  let page=makePage();await document.fonts.ready;await Promise.all([...page.querySelectorAll('img')].map(i=>i.decode()));
  const fits=()=>{const body=page.querySelector('.rm-doc-body');return body.clientHeight>20&&body.scrollHeight<=body.clientHeight+1&&page.scrollHeight<=page.clientHeight+1&&page.scrollWidth<=page.clientWidth+1;};
  const table=()=>{const wrap=document.createElement('section');wrap.className='rm-doc-products';wrap.innerHTML='<h2>Muebles de este despacho</h2><table><thead><tr><th>Descripción</th><th>Salen hoy</th><th>Quedan pendientes</th></tr></thead><tbody></tbody></table>';page.querySelector('.rm-doc-body').append(wrap);return wrap.querySelector('tbody');};
  let rows=table();
  for(const item of r.items){
    const row=document.createElement('tr');row.innerHTML=`<td>${esc(item.description)}</td><td>${item.quantity} ${esc(item.unit||'UN')}</td><td>${item.pendingAfter}</td>`;rows.append(row);
    if(!fits()){row.remove();if(!rows.children.length)throw Error('El producto excede el espacio de la remisión');page=makePage();rows=table();rows.append(row);if(!fits())throw Error('El producto excede la hoja');}
  }
  let rest=String(r.notes||'').trim(),continued=false;
  while(rest){
    const section=document.createElement('section');section.className='rm-doc-notes';section.innerHTML=`<h2>Indicaciones para la entrega${continued?' · continuación':''}</h2><p></p>`;page.querySelector('.rm-doc-body').append(section);
    const p=section.querySelector('p');let lo=0,hi=rest.length;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);p.textContent=rest.slice(0,mid);if(fits())lo=mid;else hi=mid-1;}
    if(lo===0){section.remove();if(!page.querySelector('.rm-doc-body').children.length)throw Error('No hay espacio para las indicaciones');page=makePage();continue;}
    if(lo<rest.length){const boundary=rest.lastIndexOf(' ',lo);if(boundary>lo/2)lo=boundary;}
    p.textContent=rest.slice(0,lo);rest=rest.slice(lo).trimStart();continued=true;if(rest)page=makePage();
  }
  const pages=[...target.querySelectorAll('.rm-document')];
  await Promise.all([...target.querySelectorAll('img')].map(i=>i.decode()));
  pages.forEach((p,i)=>{p.querySelector('.rm-doc-page-number').textContent=`Maddy · v${APP_CONFIG.version} · ${i+1} / ${pages.length}`;const body=p.querySelector('.rm-doc-body');if(body.scrollHeight>body.clientHeight+1||p.scrollHeight>p.clientHeight+1||p.scrollWidth>p.clientWidth+1)throw Error('Contenido fuera de la hoja');});
  return {pages:pages.length};
}
