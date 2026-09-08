// Presentation only. Checks follow operation events, never elapsed time.
export const ORDER_PROGRESS_STEPS = Object.freeze([
  ['prepare', 'Preparar el pedido', 'Datos y referencias del formulario'],
  ['record', 'Registrar pedido y pagos', 'Confirmación de la misma orden'],
  ['photos', 'Guardar las fotografías', 'Cada referencia, en su mueble'],
  ['document', 'Crear y archivar el PDF', 'Documento y carpetas en Drive'],
  ['verify', 'Comprobar los archivos', 'Lectura final de sus enlaces']
]);
const PREVIEW_STEPS = Object.freeze([
  ['prepare', 'Revisar los datos', 'Información del documento'],
  ['document', 'Componer las páginas', 'Diseño y paginación'],
  ['photos', 'Organizar las referencias', 'Anexos por mueble, cuando aplican'],
  ['verify', 'Revisar el documento', 'Imágenes y páginas listas para visualizar']
]);
const INSTANCES = new WeakMap();
const STATE_LABELS = { pending: 'Pendiente', running: 'En curso', complete: 'Confirmado', skipped: 'No aplica', unconfirmed: 'Sin confirmar' };
const SAVE_MESSAGES = {
  prepare: 'Maddy ya tiene lápiz en mano…',
  record: 'Cada acuerdo, bien anotado.',
  photos: 'Cada mueble, con su mejor foto.',
  document: 'Un toque de Maddy para tu PDF…',
  verify: 'La última mirada. Todo cuenta.'
};

// A shared visual language, with a different contract for preview and real save.
export function createDocumentProgress({ kind = 'order', mode = 'save' } = {}, doc = document) {
  if (!['order', 'quote'].includes(kind) || !['save', 'preview'].includes(mode) || (kind === 'quote' && mode === 'save')) {
    throw new Error('Este proceso documental todavía no está disponible.');
  }
  const preview = mode === 'preview';
  const noun = kind === 'quote' ? 'cotización' : 'pedido';
  const steps = preview ? PREVIEW_STEPS : ORDER_PROGRESS_STEPS;
  const headlines = preview ? {
    prepare: kind === 'quote' ? 'Lápiz listo. Vamos con tu propuesta.' : 'Maddy ya tiene lápiz en mano…',
    document: kind === 'quote' ? 'Tu propuesta va tomando forma…' : 'Tu pedido va tomando forma…',
    photos: 'Los detalles también entran por los ojos.',
    verify: 'Una última mirada, que quede impecable.'
  } : SAVE_MESSAGES;
  const count = (INSTANCES.get(doc) || 0) + 1;
  INSTANCES.set(doc, count);
  const prefix = count === 1 ? 'order-progress' : `order-progress-${count}`;
  const dialog = doc.createElement('dialog');
  dialog.className = 'order-progress-dialog';
  dialog.dataset.documentKind = kind;
  dialog.dataset.operation = mode;
  dialog.setAttribute('aria-labelledby', prefix + '-title');
  dialog.setAttribute('aria-describedby', prefix + '-message');
  dialog.innerHTML = `<div class="order-progress-shell">
    <div class="order-progress-signature"><img src="/assets/brand/maddy-by-maderarte.svg" alt="Maddy by Maderarte" width="112" height="44"></div>
    <div class="order-progress-visual">
      <span class="order-progress-halo" aria-hidden="true"></span>
      <img class="order-progress-portrait" src="/assets/brand/maddy-working-approved.webp" alt="Maddy preparando un documento en su tableta" width="420" height="560" decoding="async">
      <span class="order-progress-spark" aria-hidden="true">✦</span>
    </div>
    <section class="order-progress-content">
      <p class="order-progress-eyebrow">${preview ? 'Preparando tu ' + noun : 'Guardando tu pedido'}</p>
      <h2 id="${prefix}-title" tabindex="-1">${headlines.prepare}</h2>
      <p id="${prefix}-message" role="status" aria-live="polite" aria-atomic="true">${preview ? 'Revisando los datos para la vista previa.' : 'Comprobando los datos…'}</p>
      <ol class="order-progress-steps" aria-label="Etapas del proceso">${steps.map(([id, label, detail]) => `<li data-progress-step="${id}" data-state="pending" aria-label="${label}: Pendiente"><span class="order-progress-icon" aria-hidden="true">·</span><span class="order-progress-sr"><span class="order-progress-step-title">${label}</span><small>${detail}</small><span class="order-progress-state">Pendiente</span></span></li>`).join('')}</ol>
      <div class="order-progress-track" hidden aria-hidden="true">${steps.map(([id]) => `<span data-progress-segment="${id}" data-state="pending"></span>`).join('')}</div>
      <p class="order-progress-caption" data-progress-caption>Todo empieza por los detalles.</p>
      <p class="order-progress-number" data-progress-number hidden></p>
      <div class="order-progress-foot"><p data-progress-wait hidden></p><span data-progress-time hidden aria-hidden="true"></span></div>
      <span class="order-progress-sr" data-progress-live>En proceso</span>
      <button type="button" class="order-progress-return" hidden>Volver ${preview ? 'al documento' : 'al pedido'}</button>
    </section></div>`;
  doc.body.append(dialog);
  const title = dialog.querySelector('h2');
  const message = dialog.querySelector('[role="status"]');
  const wait = dialog.querySelector('[data-progress-wait]');
  const clock = dialog.querySelector('[data-progress-time]');
  const close = dialog.querySelector('button');
  const numberNode = dialog.querySelector('[data-progress-number]');
  const live = dialog.querySelector('[data-progress-live]');
  const caption = dialog.querySelector('[data-progress-caption]');
  const portrait = dialog.querySelector('.order-progress-portrait');
  const win = doc.defaultView;
  let timer = null, started = 0, stageStarted = 0, busy = false, active = '', previousFocus, destroyed = false;
  portrait.addEventListener('error', () => { portrait.hidden = true; dialog.dataset.imageFailed = 'true'; });
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function stop() { if (timer !== null) win.clearInterval(timer); timer = null; }
  function resetWait() {
    stageStarted = Date.now();
    wait.hidden = true; clock.hidden = true;
    wait.textContent = preview ? 'Sigo preparando las páginas. Conserva esta ventana abierta.' : 'Conserva esta ventana abierta. No necesitas volver a pulsar Guardar.';
  }
  function open() {
    if (destroyed) return;
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
        if (Date.now() - stageStarted >= 15000) {
          wait.textContent = preview ? 'Las páginas están tardando un poco. Sigo esperando su respuesta.' : 'Esta etapa aún no confirma su respuesta. Seguimos esperando; no repitas el guardado.';
          wait.hidden = false; clock.hidden = false;
        }
      }, 1000);
    }
  }
  function hide() {
    stop(); busy = false;
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    if (previousFocus?.isConnected && !previousFocus.disabled) previousFocus.focus({ preventScroll: true });
    else doc.querySelector('#order-save-status button')?.focus({ preventScroll: true });
  }
  function begin() {
    if (destroyed) return;
    stop(); clock.textContent = ''; active = ''; numberNode.hidden = true; numberNode.textContent = '';
    resetWait();
    message.textContent = preview ? 'Revisando los datos para la vista previa.' : 'Comprobando los datos…';
    caption.textContent = 'Todo empieza por los detalles.';
    for (const [id, label, detail] of steps) {
      const row = dialog.querySelector(`[data-progress-step="${id}"]`);
      row.dataset.state = 'pending'; row.removeAttribute('aria-current'); row.setAttribute('aria-label', label + ': Pendiente');
      dialog.querySelector(`[data-progress-segment="${id}"]`).dataset.state = 'pending';
      row.querySelector('.order-progress-icon').textContent = '·';
      row.querySelector('small').textContent = detail;
      row.querySelector('.order-progress-state').textContent = 'Pendiente';
    }
    title.textContent = headlines.prepare;
    open();
  }
  function update(event) {
    if (destroyed) return;
    const entry = steps.find(([id]) => id === event?.step);
    if (!entry || !['running', 'complete', 'skipped'].includes(event.status)) return;
    const row = dialog.querySelector(`[data-progress-step="${event.step}"]`);
    open();
    if (event.status === 'running') {
      if (active !== event.step) resetWait();
      active = event.step;
      dialog.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current'));
      row.setAttribute('aria-current', 'step');
      setText(title, headlines[event.step]);
      setText(caption, `${entry[1]} · ${steps.indexOf(entry) + 1} de ${steps.length}`);
    }
    row.dataset.state = event.status;
    row.setAttribute('aria-label', entry[1] + ': ' + STATE_LABELS[event.status]);
    dialog.querySelector(`[data-progress-segment="${event.step}"]`).dataset.state = event.status;
    if (event.status !== 'running') row.removeAttribute('aria-current');
    row.querySelector('.order-progress-icon').textContent = event.status === 'complete' ? '✓' : event.status === 'skipped' ? '—' : '·';
    setText(row.querySelector('.order-progress-state'), STATE_LABELS[event.status]);
    if (event.detail) setText(row.querySelector('small'), event.detail);
    if (event.message) setText(message, event.message);
    // A form's predicted consecutive must never be presented as a confirmed number.
    if (!preview && event.number && event.status === 'complete') { setText(numberNode, 'Pedido ' + String(event.number).slice(0, 100)); numberNode.hidden = false; }
  }
  function pause(text) {
    if (!dialog.open || destroyed) return;
    stop(); busy = false; dialog.dataset.mode = 'paused'; live.textContent = 'Por confirmar';
    const entry = steps.find(([id]) => id === active);
    const row = entry && dialog.querySelector(`[data-progress-step="${active}"]`);
    if (row && row.dataset.state === 'running') {
      row.dataset.state = 'unconfirmed'; row.removeAttribute('aria-current'); row.setAttribute('aria-label', entry[1] + ': Sin confirmar');
      dialog.querySelector(`[data-progress-segment="${active}"]`).dataset.state = 'unconfirmed';
      row.querySelector('.order-progress-icon').textContent = '!';
      row.querySelector('.order-progress-state').textContent = 'Sin confirmar';
    }
    title.textContent = 'Hagamos una pequeña pausa.';
    message.textContent = text || 'No se confirmó el resultado.';
    caption.textContent = preview ? 'Tu formulario sigue aquí.' : 'Conservamos el mismo intento.';
    wait.textContent = preview ? 'Vuelve al documento para revisar el aviso.' : 'Vuelve al pedido para consultar o retomar el mismo intento. No crees otra orden.';
    wait.hidden = false; close.hidden = false; close.focus({ preventScroll: true });
  }
  function sync(state) {
    if (destroyed) return;
    if (state.phase === 'confirmed') {
      title.textContent = preview ? '¡Lista para tu última mirada!' : '¡Listo! Todo en su lugar.';
      hide();
    } else if (state.phase === 'checking') {
      begin(); update({ step: preview ? 'verify' : 'record', status: 'running', message: state.message });
    } else if (['uncertain', 'retry', 'blocked', 'other-tab', 'rejected', 'disabled'].includes(state.phase)
      || state.phase === 'documents' && !state.working) pause(state.message || 'No se confirmó el resultado.');
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) hide(); });
  close.addEventListener('click', hide);
  win.addEventListener('pagehide', stop);
  return { begin, update, pause, sync, destroy() { hide(); destroyed = true; dialog.remove(); win.removeEventListener('pagehide', stop); } };
}

export function createOrderProgress(doc = document) {
  return createDocumentProgress({ kind: 'order', mode: 'save' }, doc);
}
