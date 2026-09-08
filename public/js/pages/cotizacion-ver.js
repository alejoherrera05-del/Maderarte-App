import { sandboxLink, bindSandboxBanner } from '../core/order-sandbox-context.js';
import { apiRequest } from '../core/api.js?v=sandbox-1';
import { guardStandalonePage } from '../core/page-guard.js';
import { escapeHtml } from '../core/format.js';
import { hasPermission } from '../core/permissions.js';

const money = value => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(value)||0);
const params = new URLSearchParams(location.search);
const number = String(params.get('cot') || '').trim();

function itemMarkup(item,index){
  const facts=[item.category,item.fabric,item.wood].filter(Boolean).join(' · ');
  return `<article class="qv-item"><span class="qv-index">${String(index+1).padStart(2,'0')}</span><div><h3>${escapeHtml(item.description||'Mueble')}</h3><p>${escapeHtml([`${item.quantity} × ${money(item.unitValue)}`,facts,item.specifications].filter(Boolean).join(' · '))}</p></div><strong class="qv-item-price">${escapeHtml(money(item.subtotal))}</strong></article>`;
}

async function openPdf(){
  const button=document.getElementById('qv-open-pdf');
  if(button) button.disabled=true;
  const popup=window.open('about:blank','_blank'); if(popup) popup.opener=null;
  try{
    const response=await apiRequest('COTIZACION_PDF_LEER',{number},{timeoutMs:90000});
    if(response.data?.mime!=='application/pdf'||typeof response.data.base64!=='string') throw new Error('No se recibió un PDF válido.');
    const bytes=Uint8Array.from(atob(response.data.base64),c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    if(popup) popup.location.replace(url); else { const a=document.createElement('a'); a.href=url; a.download=response.data.name||`${number}.pdf`; a.click(); }
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(error){ popup?.close(); document.getElementById('qv-message').textContent=error.message||'No se pudo abrir el PDF.'; }
  finally{ if(button) button.disabled=false; }
}

function render(data,session){
  const app=document.getElementById('quote-view-app');
  const c=data.clientDetail||{};
  const items=Array.isArray(data.items)?data.items:[];
  const docs=data.documents||{complete:false,files:[]};
  app.innerHTML=`<div class="qv-shell">
    <header class="qv-header"><a class="qv-back" href="/cotizaciones.html">‹ Volver</a><div class="qv-title"><img src="/assets/brand/maderarte-logo-2026.webp" alt=""><div><h1>Cotización</h1><p>Expediente comercial</p></div></div><a class="qv-action" href="/cotizacion.html">Nueva cotización</a></header>
    <section class="qv-card qv-hero"><div><p class="qv-eyebrow">Propuesta emitida</p><h2 class="qv-number">${escapeHtml(data.number)}</h2><p class="qv-meta">${escapeHtml(data.branch||'')} · ${escapeHtml(new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'}).format(new Date(data.date)))}</p><span class="qv-status ${docs.complete?'':'pending'}">${docs.complete?'PDF y archivo confirmados':'Documento pendiente de completar'}</span></div><div class="qv-total"><small>Total cotizado</small><strong>${escapeHtml(money(data.total))}</strong></div></section>
    <section class="qv-card"><h2 class="qv-section-title">Cliente</h2><div class="qv-grid"><div class="qv-field"><small>Nombre</small><strong>${escapeHtml(data.client||c.name||'—')}</strong></div><div class="qv-field"><small>Cédula / NIT</small><strong>${escapeHtml(data.document||c.document||'—')}</strong></div><div class="qv-field"><small>Teléfono</small><strong>${escapeHtml(data.phone||c.phone||'—')}</strong></div><div class="qv-field"><small>Correo</small><strong>${escapeHtml(c.email||'—')}</strong></div><div class="qv-field"><small>Ciudad</small><strong>${escapeHtml(c.city||'—')}</strong></div><div class="qv-field"><small>Dirección</small><strong>${escapeHtml(c.address||data.address||'—')}</strong></div></div></section>
    <section class="qv-card"><h2 class="qv-section-title">Mobiliario cotizado</h2><div class="qv-items">${items.map(itemMarkup).join('')}</div></section>
    <section class="qv-card"><h2 class="qv-section-title">Resumen</h2><div class="qv-finance"><div><span>Subtotal</span><strong>${escapeHtml(money(data.subtotal))}</strong></div><div><span>Descuento</span><strong>${escapeHtml(money(data.discount))}</strong></div><div><span>Total</span><strong>${escapeHtml(money(data.total))}</strong></div></div>${data.observations?`<p class="qv-note">${escapeHtml(data.observations)}</p>`:''}</section>
    <section class="qv-card"><h2 class="qv-section-title">Estado comercial</h2><p>${escapeHtml(data.status||'ACTIVA')}</p>${data.convertedOrder?`<a class="qv-action" href="${escapeHtml(sandboxLink(`/orden.html?op=${encodeURIComponent(data.convertedOrder)}`))}">Ver OP ${escapeHtml(data.convertedOrder)}</a>`:''}</section><section class="qv-card"><h2 class="qv-section-title">Documento</h2><div class="qv-actions"><button class="qv-action qv-action-primary" id="qv-open-pdf" type="button" ${docs.complete?'':'disabled'}>Abrir PDF</button><a class="qv-action" href="/cotizaciones.html">Ir a seguimiento</a></div><p id="qv-message" class="qv-meta">${docs.complete?'El PDF corresponde a esta misma cotización y se lee desde el archivo privado.':'La cotización existe, pero su PDF todavía no está confirmado.'}</p></section>
  </div>`;
  app.hidden=false;
  if (!data.convertedOrder && ['ACTIVA','EMITIDA'].includes(data.status) && docs.complete && hasPermission(session,'ordenes.create')) {
    const convert = document.createElement('a'); convert.className = 'qv-action qv-action-primary';
    convert.href = sandboxLink(`/pedido.html?cotizacion=${encodeURIComponent(data.number)}`);
    convert.textContent = 'Preparar orden de pedido'; app.querySelector('.qv-actions').prepend(convert);
  }
  app.querySelectorAll('a[href^="/"]').forEach(link=>{link.href=sandboxLink(link.getAttribute('href'));});
  bindSandboxBanner(app);
  document.getElementById('qv-open-pdf')?.addEventListener('click',openPdf);
}

function renderError(error){
  const app=document.getElementById('quote-view-app'); app.hidden=false;
  app.innerHTML=`<div class="qv-shell"><section class="qv-card qv-error"><h2>No pude abrir esta cotización</h2><p>${escapeHtml(error.message||'Revisa el número e inténtalo nuevamente.')}</p><a class="qv-action" href="/cotizaciones.html">Volver a seguimiento</a></section></div>`;
}

guardStandalonePage({permission:'cotizaciones.read',async render({session}){
  if(!number){renderError(new Error('Falta el número de cotización.'));return;}
  try{const response=await apiRequest('COTIZACION_OBTENER',{number});render(response.data,session);}catch(error){renderError(error);}
}});
