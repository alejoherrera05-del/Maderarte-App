import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {enhancePayrollPremiumUx} from '../public/js/core/payroll-premium.js';

const dom=new JSDOM('<!doctype html><body><div id="payroll-boot"></div><div id="root"></div></body>',{url:'https://app.example.test/nomina.html'});
Object.assign(globalThis,{
  window:dom.window,
  document:dom.window.document,
  MutationObserver:dom.window.MutationObserver,
});

const root=document.getElementById('root');
root.innerHTML=`
<header class="cfg-header"><div class="cfg-header-inner"><a class="cfg-round" href="/index.html">←</a><div class="cfg-brand"><strong>Nómina</strong><span>Maddy · by Maderarte</span></div><button id="np-refresh">Actualizar</button></div></header>
<main class="np-wrap">
  <div class="np-top"><div><span class="np-eyebrow">Pagos del equipo</span><h1>Nómina</h1><p>Texto</p></div><div class="np-actions"><a href="/configuracion.html#nomina">Configurar nómina</a><button id="np-new">Otro pago</button></div></div>
  <nav class="np-tabs"><button data-tab="quincena" aria-pressed="true">Quincena</button><button data-tab="comprobantes" aria-pressed="false">Historial</button><button data-tab="comisiones" aria-pressed="false">Comisiones</button></nav>
  <div id="np-content">
    <section class="np-run-picker"><div><h2>Periodo</h2><p>Ayuda</p></div><label>Mes<input type="month" value="2026-09"></label><label>Quincena<select><option value="1">Primera</option><option value="2" selected>Segunda</option></select></label></section>
    <div class="np-run-people"><article class="np-run-person"><div class="np-run-name"><h3>Ana</h3><span class="np-run-state">Falta revisar</span></div></article><article class="np-run-person np-friendly-paid"><div class="np-run-name"><h3>Luis</h3><span class="np-run-state is-paid">Pagado</span></div></article></div>
  </div>
</main>`;

enhancePayrollPremiumUx(root);
assert.ok(root.classList.contains('np-premium-ready'));
assert.equal(root.querySelector('.cfg-brand span').textContent,'Maddy');
assert.ok(root.querySelector('.np-premium-menu-trigger'));
assert.ok(root.querySelector('#np-premium-menu'));
assert.match(root.querySelector('#np-premium-menu').textContent,/Otro tipo de pago/);
assert.equal(root.querySelector('#np-premium-title').textContent,'Segunda quincena');
assert.match(root.querySelector('#np-premium-subtitle').textContent,/Septiembre de 2026/);
assert.equal(root.querySelector('.np-premium-list-count').textContent,'1 pendiente');
assert.ok(document.getElementById('payroll-boot').classList.contains('is-hidden'));

root.querySelector('[data-tab="comprobantes"]').setAttribute('aria-pressed','true');
root.querySelector('[data-tab="quincena"]').setAttribute('aria-pressed','false');
enhancePayrollPremiumUx(root);
assert.equal(root.querySelector('#np-premium-title').textContent,'Historial de pagos');

const html=readFileSync(new URL('../public/nomina.html',import.meta.url),'utf8');
assert.match(html,/class="np-premium-page"/);
assert.match(html,/id="payroll-boot"/);
assert.match(html,/Preparando tu quincena/);
assert.match(html,/nomina-premium\.css/);
const css=readFileSync(new URL('../public/css/nomina-premium.css',import.meta.url),'utf8');
assert.match(css,/\.np-premium-hero/);
assert.match(css,/@media\(max-width:700px\)/);
assert.match(css,/backdrop-filter/);

console.log('Payroll premium UX: first-frame loader, app header, secondary menu, period hero, pending count and responsive shell passed.');
