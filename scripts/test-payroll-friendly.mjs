import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {enhancePayrollFriendlyUx} from '../public/js/core/payroll-friendly.js';

const dom=new JSDOM('<!doctype html><body><div id="root"></div></body>',{url:'https://app.example.test/nomina.html'});
Object.assign(globalThis,{
  window:dom.window,
  document:dom.window.document,
  Node:dom.window.Node,
  Event:dom.window.Event,
  MutationObserver:dom.window.MutationObserver,
  requestAnimationFrame:(fn)=>fn(),
});
const root=document.getElementById('root');

root.innerHTML=`
  <header class="cfg-header"><div class="cfg-header-inner"><a class="cfg-round" href="/index.html">←</a><div class="cfg-brand"><strong>Nómina</strong><span>Maddy · by Maderarte</span></div><button class="np-button" id="np-refresh">Actualizar</button></div></header>
  <main class="np-wrap">
    <div class="np-top"><div><span class="np-eyebrow">Personas y pagos</span><h1>Nómina</h1><p>Revisa tu quincena y registra cada pago.</p></div><div class="np-actions"><a class="np-button" href="/configuracion.html#nomina">Configurar nómina</a><button id="np-new" class="np-button dark">Nuevo comprobante</button></div></div>
    <nav class="np-tabs"><button data-tab="quincena" aria-pressed="true">Quincena</button><button data-tab="comprobantes" aria-pressed="false">Comprobantes</button><button data-tab="comisiones" aria-pressed="false">Comisiones</button></nav>
    <div id="np-content"><div id="np-run-result">
    <section class="np-run-picker"><div><h2>¿Qué quincena vas a preparar?</h2><p>Elige el período y revisa a cada persona antes de registrar su pago.</p></div></section>
    <div class="np-summary"><div><small>Total previsto</small><strong>$ 2</strong></div><div><small>Por registrar como pagado</small><strong>$ 1</strong></div><div><small>Pagos registrados</small><strong>$ 1</strong></div></div>
    <ol class="np-run-steps"><li><b>1</b> Revisa días y novedades</li><li><b>2</b> Confirma el desglose</li><li><b>3</b> Registra el pago realizado</li></ol>
    <div class="np-run-people">
      <article class="np-run-person" id="paid"><div class="np-run-name"><h3>Pagada</h3><span class="np-run-state is-paid">✓ Pago registrado</span></div><button class="np-button" data-run-person="0">Ver comprobante <span>→</span></button></article>
      <article class="np-run-person" id="pending"><div class="np-run-name"><h3>Pendiente</h3><span class="np-run-state">Por revisar</span></div><button class="np-button primary" data-run-person="1">Revisar pago <span>→</span></button></article>
    </div>
    <p class="np-run-help">Registrar un pago deja constancia del dinero que ya entregaste.</p>
    </div></div>
    <footer class="np-footer">Maddy · by Maderarte</footer>
  </main>`;

enhancePayrollFriendlyUx(root);
assert.equal(root.querySelector('.np-top h1').textContent,'Pagos del equipo');
assert.equal(root.querySelector('.np-eyebrow').hidden,true);
assert.match(root.querySelector('.np-top p').textContent,/registra cada pago/);
assert.equal(root.querySelector('[data-tab="comprobantes"]').textContent,'Historial');
assert.equal(root.querySelector('#np-refresh').classList.contains('cfg-round'),true);
assert.equal(root.querySelector('#np-refresh img').getAttribute('src'),'/assets/icons/arrow-clockwise.svg');
assert.equal(root.querySelector('.np-top #np-new'),null);
assert.equal(root.querySelector('.np-friendly-tools #np-new').textContent,'Otro pago');
assert.equal(root.querySelector('.np-friendly-tools a[href*="configuracion"]').textContent,'Configuración de nómina');
assert.equal(root.querySelector('.np-run-picker h2').textContent,'¿Qué quincena quieres pagar?');
assert.equal(root.querySelector('.np-summary div:nth-child(2) small').textContent,'Pendiente');
assert.equal(root.querySelector('.np-run-people').firstElementChild.id,'pending');
assert.equal(root.querySelector('#pending .np-run-state').textContent,'Falta revisar');
assert.match(root.querySelector('#pending [data-run-person]').textContent,/Preparar pago/);
assert.equal(root.querySelector('#paid .np-run-state').textContent,'✓ Pagado');
assert.match(root.querySelector('.np-friendly-guide strong').textContent,/1 pago por completar/);

root.innerHTML=`
  <div id="np-title">Revisar a Carlos</div>
  <dialog id="np-dialog" open><div class="np-dialog-body">
    <form id="np-form" class="np-form">
      <div id="np-concepts">
        <div class="np-grid"><label>Días remunerados<input name="workedDays" value="15" max="15"></label><label>Días no remunerados<input name="absent" value="0" max="15"></label></div>
        <p id="np-days-summary">15 días del período · 15 remunerados · 0 no remunerados</p>
        <label id="np-absence-label" hidden>Motivo<input name="absenceReason"></label>
        <p class="np-hint">Los descansos remunerados no son ausencias.</p>
        <details class="np-novelties"><summary>Permisos, vacaciones o incapacidad</summary><label>¿Qué ocurrió?<select name="noveltyType"><option value="NINGUNA">Sin novedad adicional</option><option value="PERMISO">Permiso</option></select></label></details>
      </div>
      <details class="np-novelties np-extra-details"><summary>Anticipos y otros ajustes</summary><div class="np-form"></div></details>
      <button class="np-button primary" type="submit">Revisar desglose</button>
      <button class="np-button" type="button" id="np-save-draft">Guardar y continuar después</button>
    </form>
  </div></dialog>`;

enhancePayrollFriendlyUx(root);
const form=root.querySelector('#np-form');
assert.ok(form.querySelector('.np-friendly-attendance-question'));
assert.equal(form.querySelector('button[type="submit"]').disabled,true);
assert.equal(form.querySelector('.np-extra-details summary').textContent,'¿Hay anticipos u otros ajustes?');
assert.equal(form.querySelector('#np-save-draft').textContent,'Guardar para después');
form.querySelector('[data-friendly-attendance="complete"]').click();
assert.equal(form.dataset.friendlyAttendance,'complete');
assert.equal(form.elements.absent.value,'0');
assert.equal(form.querySelector('button[type="submit"]').disabled,false);
assert.match(form.querySelector('button[type="submit"]').textContent,/Ver total a pagar/);

root.innerHTML=`
  <div id="np-title">Revisar comprobante</div>
  <dialog id="np-dialog" open><div class="np-dialog-body">
    <p class="np-period"><strong>Carlos Pérez</strong></p>
    <div class="np-total"><span>Neto a pagar</span><strong>$ 1.000</strong></div>
    <p class="np-hint">Al emitir se reservarán las comisiones seleccionadas. El pago se registra por separado.</p>
    <div class="np-actions"><button id="np-back">Editar</button><button id="np-save-review">Guardar revisión</button><button id="np-issue">Dejar listo para pago</button></div>
  </div></dialog>`;

enhancePayrollFriendlyUx(root);
assert.equal(root.querySelector('#np-title').textContent,'Este es el pago de Carlos Pérez');
assert.equal(root.querySelector('.np-total span').textContent,'Total a pagar');
assert.equal(root.querySelector('#np-back').textContent,'Corregir algo');
assert.match(root.querySelector('#np-issue').textContent,/Está correcto/);
assert.ok(root.querySelector('.np-friendly-review-help'));

console.log('Payroll friendly UX: plain-language shell, pending-first ordering, guided attendance and readable review passed.');
