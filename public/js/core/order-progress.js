// Observational UI only: no requests, no percentages, no timer-based success.
export const ORDER_PROGRESS_STEPS = Object.freeze([
  ['prepare', 'Preparar el pedido', 'Datos y referencias del formulario'],
  ['record', 'Registrar pedido y pagos', 'Confirmación de la misma orden'],
  ['photos', 'Guardar las fotografías', 'Cada referencia, en su mueble'],
  ['document', 'Crear y archivar el PDF', 'Documento y carpetas en Drive'],
  ['verify', 'Comprobar los archivos', 'Lectura final de sus enlaces']
]);

export function createOrderProgress(doc = document) {
  const dialog = doc.createElement('dialog');
  dialog.className = 'order-progress-dialog';
  dialog.setAttribute('aria-labelledby', 'order-progress-title');
  dialog.setAttribute('aria-describedby', 'order-progress-message');
  dialog.innerHTML = `<div class="order-progress-shell">
    <aside class="order-progress-visual" aria-label="Maddy, tu asistente de Maderarte">
      <img class="order-progress-portrait" src="/assets/brand/maddy-loader-portrait.webp" alt="Maddy con su uniforme gris y detalles naranja" width="400" height="607" decoding="async">
      <div class="order-progress-signature"><img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte" width="150" height="60"><p>Cada detalle,<br>en su lugar.</p></div>
    </aside>
    <section class="order-progress-content">
      <div class="order-progress-brand"><img src="/assets/brand/maderarte-logo-2026.webp" alt="" width="28" height="28"><span>MADERARTE</span><span class="order-progress-live" data-progress-live>En proceso</span></div>
      <div class="order-progress-heading"><p class="order-progress-eyebrow">TU ORDEN DE PEDIDO</p><h2 id="order-progress-title" tabindex="-1">Estamos creando tu pedido</h2><p class="order-progress-number" data-progress-number hidden></p></div>
      <p id="order-progress-message" role="status" aria-live="polite" aria-atomic="true">Comprobando los datos…</p>
      <div class="order-progress-track" aria-hidden="true">${ORDER_PROGRESS_STEPS.map(([id]) => `<span data-progress-segment="${id}" data-state="pending"></span>`).join('')}</div>
      <ol class="order-progress-steps">${ORDER_PROGRESS_STEPS.map(([id, title, detail], i) => `<li data-progress-step="${id}" data-state="pending"><span class="order-progress-icon" aria-hidden="true">${i + 1}</span><div><span class="order-progress-step-title">${title}</span><small>${detail}</small></div><span class="order-progress-state">Pendiente</span></li>`).join('')}</ol>
      <div class="order-progress-foot"><span class="order-progress-note-icon" aria-hidden="true">i</span><p data-progress-wait>Conserva esta ventana abierta. No necesitas volver a pulsar Guardar.</p><span data-progress-time aria-hidden="true"></span></div>
      <button type="button" class="order-progress-return" hidden>Volver al pedido</button>
    </section></div>`;
  doc.body.append(dialog);
  const title = dialog.querySelector('h2');
  const message = dialog.querySelector('[role="status"]');
  const wait = dialog.querySelector('[data-progress-wait]');
  const clock = dialog.querySelector('[data-progress-time]');
  const close = dialog.querySelector('button');
  const numberNode = dialog.querySelector('[data-progress-number]');
  const live = dialog.querySelector('[data-progress-live]');
  const portrait = dialog.querySelector('.order-progress-portrait');
  portrait.addEventListener('error', () => { portrait.hidden = true; });
  let timer = null, started = 0, stageStarted = 0, busy = false, active = '', previousFocus;
  const win = doc.defaultView;
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function stop() { if (timer !== null) win.clearInterval(timer); timer = null; }
  function open() {
    if (!dialog.open) {
      previousFocus = doc.activeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      title.focus({ preventScroll: true });
    }
    busy = true; close.hidden = true; dialog.dataset.mode = 'working'; live.textContent = 'En proceso';
    if (timer === null) {
      started = Date.now();
      timer = win.setInterval(() => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} transcurridos`;
        if (Date.now() - stageStarted >= 15000) wait.textContent = 'Esta etapa aún no confirma su respuesta. Seguimos esperando; no repitas el guardado.';
      }, 1000);
    }
  }
  function hide() {
    stop(); busy = false;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    if (previousFocus?.isConnected && !previousFocus.disabled) previousFocus.focus({ preventScroll: true });
    else doc.querySelector('#order-save-status button')?.focus({ preventScroll: true });
  }
  function begin() {
    stop(); clock.textContent = ''; active = ''; stageStarted = Date.now(); numberNode.hidden = true; numberNode.textContent = '';
    message.textContent = 'Comprobando los datos…';
    for (const [id, , detail] of ORDER_PROGRESS_STEPS) {
      const row = dialog.querySelector(`[data-progress-step="${id}"]`);
      row.dataset.state = 'pending'; row.removeAttribute('aria-current');
      dialog.querySelector(`[data-progress-segment="${id}"]`).dataset.state = 'pending';
      row.querySelector('.order-progress-icon').textContent = String(ORDER_PROGRESS_STEPS.findIndex(s => s[0] === id) + 1);
      row.querySelector('small').textContent = detail;
      row.querySelector('.order-progress-state').textContent = 'Pendiente';
    }
    title.textContent = 'Estamos creando tu pedido';
    wait.textContent = 'Conserva esta pestaña abierta. No necesitas volver a pulsar Guardar.';
    open();
  }
  function update(event) {
    const row = dialog.querySelector(`[data-progress-step="${event.step}"]`);
    if (!row || !['running', 'complete', 'skipped'].includes(event.status)) return;
    open();
    if (event.status === 'running') {
      if (active !== event.step) {
        stageStarted = Date.now();
        wait.textContent = 'Conserva esta ventana abierta. No necesitas volver a pulsar Guardar.';
      }
      active = event.step;
      dialog.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current'));
      row.setAttribute('aria-current', 'step');
    }
    row.dataset.state = event.status;
    dialog.querySelector(`[data-progress-segment="${event.step}"]`).dataset.state = event.status;
    if (event.status !== 'running') row.removeAttribute('aria-current');
    row.querySelector('.order-progress-icon').textContent = event.status === 'complete' ? '✓' : event.status === 'skipped' ? '—' : '·';
    setText(row.querySelector('.order-progress-state'), { running: 'En curso', complete: 'Confirmado', skipped: 'No aplica' }[event.status]);
    if (event.detail) setText(row.querySelector('small'), event.detail);
    if (event.message) setText(message, event.message);
    if (event.number) { setText(numberNode, 'Pedido ' + event.number); numberNode.hidden = false; }
  }
  function pause(text) {
    if (!dialog.open) return;
    stop(); busy = false; dialog.dataset.mode = 'paused'; live.textContent = 'Por confirmar';
    const row = dialog.querySelector(`[data-progress-step="${active}"]`);
    if (row && row.dataset.state === 'running') {
      row.dataset.state = 'unconfirmed'; row.removeAttribute('aria-current');
      dialog.querySelector(`[data-progress-segment="${active}"]`).dataset.state = 'unconfirmed';
      row.querySelector('.order-progress-icon').textContent = '!';
      row.querySelector('.order-progress-state').textContent = 'Sin confirmar';
    }
    title.textContent = 'Revisemos el estado del pedido';
    message.textContent = text;
    wait.textContent = 'Vuelve al pedido para consultar o retomar el mismo intento. No crees otra orden.';
    close.hidden = false; close.focus({ preventScroll: true });
  }
  function sync(state) {
    if (state.phase === 'confirmed') hide();
    else if (state.phase === 'checking') {
      begin(); update({ step: 'record', status: 'running', message: state.message });
    } else if (['uncertain', 'retry', 'blocked', 'other-tab', 'rejected', 'disabled'].includes(state.phase)
      || state.phase === 'documents' && !state.working) pause(state.message || 'No se confirmó el resultado.');
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) hide(); });
  close.addEventListener('click', hide);
  win.addEventListener('pagehide', stop);
  return { begin, update, pause, sync, destroy() { hide(); dialog.remove(); win.removeEventListener('pagehide', stop); } };
}
