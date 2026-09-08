// Presentation only. Checks follow operation events, never elapsed time.
export const ORDER_PROGRESS_STEPS = Object.freeze([
  ['prepare', 'Validar la venta', 'Cliente, sede, muebles, cantidades y valores'],
  ['record', 'Registrar pedido y pago', 'Acuerdos por mueble y medios de pago'],
  ['photos', 'Archivar referencias', 'Fotografías asociadas al mueble correcto'],
  ['document', 'Armar expediente', 'PDF y carpetas del pedido'],
  ['verify', 'Confirmar expediente', 'Pedido, pagos, referencias y documentos enlazados']
]);
const QUOTE_SAVE_STEPS = Object.freeze([
  ['prepare', 'Validar propuesta', 'Cliente, sede, muebles, cantidades y valores'],
  ['record', 'Emitir cotización', 'Consecutivo real y propuesta comercial'],
  ['photos', 'Archivar referencias', 'Fotografías asociadas al mueble correcto'],
  ['document', 'Archivar documento', 'PDF y carpeta de la cotización'],
  ['verify', 'Confirmar archivo', 'Cotización, referencias y enlaces confirmados']
]);
const PREVIEW_STEPS = Object.freeze([
  ['prepare', 'Validar información', 'Cliente, muebles, acabados, cantidades y valores'],
  ['document', 'Componer documento', 'Jerarquía, páginas, valores y condiciones'],
  ['photos', 'Ordenar referencias', 'Fotografías junto al mueble correspondiente'],
  ['verify', 'Revisar resultado', 'Nombres, valores, imágenes y condiciones']
]);
const INSTANCES = new WeakMap();
const STATE_LABELS = { pending: 'Pendiente', running: 'En curso', complete: 'Confirmado', skipped: 'No aplica', unconfirmed: 'Sin confirmar' };
const ORDER_SAVE_MESSAGES = {
  prepare: 'Primero confirmo que la venta esté bien planteada.',
  record: 'Estoy registrando exactamente lo que se acordó.',
  photos: 'Cada referencia, en el mueble correcto.',
  document: 'Estoy armando el expediente del pedido.',
  verify: 'Compruebo que no haya quedado nada suelto.'
};
const QUOTE_SAVE_MESSAGES = {
  prepare: 'Primero confirmo que la propuesta esté completa.',
  record: 'Ahora sí: voy a emitir esta cotización.',
  photos: 'Cada referencia, en el mueble correcto.',
  document: 'Estoy archivando la propuesta como corresponde.',
  verify: 'Compruebo que la cotización haya quedado completa.'
};

export function createDocumentProgress({ kind = 'order', mode = 'save' } = {}, doc = document) {
  if (!['order', 'quote'].includes(kind) || !['save', 'preview'].includes(mode)) throw new Error('Este proceso documental todavía no está disponible.');
  const preview = mode === 'preview';
  const noun = kind === 'quote' ? 'cotización' : 'pedido';
  const steps = preview ? PREVIEW_STEPS : kind === 'quote' ? QUOTE_SAVE_STEPS : ORDER_PROGRESS_STEPS;
  const headlines = preview ? {
    prepare: kind === 'quote' ? 'Déjame revisar que la propuesta salga completa.' : 'Primero confirmo que el pedido esté bien planteado.',
    document: kind === 'quote' ? 'Estoy dándole forma a la propuesta de Maderarte.' : 'Estoy organizando el documento del pedido.',
    photos: kind === 'quote' ? 'Ahora organizo cada mueble y sus referencias.' : 'Cada referencia, en el mueble correcto.',
    verify: kind === 'quote' ? 'Una última revisión antes de mostrártela.' : 'Una última revisión antes de mostrártelo.'
  } : (kind === 'quote' ? QUOTE_SAVE_MESSAGES : ORDER_SAVE_MESSAGES);
  const support = preview ? {
    prepare: kind === 'quote'
      ? 'Compruebo cliente, muebles, acabados, cantidades y valores antes de armar la cotización.'
      : 'Compruebo cliente, muebles, acuerdos, pagos y referencias antes de armar el pedido.',
    document: kind === 'quote'
      ? 'Organizo la información, los totales y las condiciones con el formato comercial aprobado.'
      : 'Organizo los muebles, valores, pagos y condiciones con el formato aprobado de la orden.',
    photos: 'Las fotografías quedan junto al mueble al que realmente pertenecen.',
    verify: kind === 'quote'
      ? 'Reviso nombres, valores, condiciones e imágenes para que no salga nada incompleto.'
      : 'Reviso nombres, acuerdos, pagos e imágenes antes de mostrarte el documento.'
  } : kind === 'quote' ? {
    prepare: 'Reviso cliente, sede, muebles, cantidades, acabados y valores antes de consumir un consecutivo real.',
    record: 'Registro una sola cotización con su número oficial y con los mismos datos que acabas de revisar.',
    photos: 'Archivo cada fotografía junto al mueble correspondiente para poder recuperar la propuesta completa.',
    document: 'Genero el PDF aprobado y lo guardo dentro de la carpeta de cotizaciones de este cliente.',
    verify: 'Compruebo que cotización, referencias, PDF y enlaces de Drive hayan quedado confirmados antes de terminar.'
  } : {
    prepare: 'Reviso cliente, sede, muebles, cantidades y lo acordado para cada producto antes de registrar nada.',
    record: 'Guardo la misma orden y el pago recibido hoy; las notas internas permanecen fuera del documento del cliente.',
    photos: 'Archivo cada fotografía en el mueble correcto para que las referencias no se mezclen.',
    document: 'Genero la orden y organizo su PDF y sus carpetas dentro del archivo del cliente.',
    verify: 'Compruebo que pedido, pagos, fotografías y documento hayan quedado enlazados antes de terminar.'
  };
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
      <p class="order-progress-eyebrow">${preview ? 'Preparando tu ' + noun : 'Guardando tu ' + noun}</p>
      <h2 id="${prefix}-title" tabindex="-1">${headlines.prepare}</h2>
      <p id="${prefix}-message" role="status" aria-live="polite" aria-atomic="true">${support.prepare}</p>
      <ol class="order-progress-steps" aria-label="Etapas del proceso">${steps.map(([id, label, detail]) => `<li data-progress-step="${id}" data-state="pending" aria-label="${label}: Pendiente"><span class="order-progress-icon" aria-hidden="true">·</span><span class="order-progress-sr"><span class="order-progress-step-title">${label}</span><small>${detail}</small><span class="order-progress-state">Pendiente</span></span></li>`).join('')}</ol>
      <div class="order-progress-track" hidden aria-hidden="true">${steps.map(([id]) => `<span data-progress-segment="${id}" data-state="pending"></span>`).join('')}</div>
      <p class="order-progress-caption" data-progress-caption>Revisión comercial en curso.</p>
      <p class="order-progress-number" data-progress-number hidden></p>
      <div class="order-progress-foot"><p data-progress-wait hidden></p><span data-progress-time hidden aria-hidden="true"></span></div>
      <span class="order-progress-sr" data-progress-live>En proceso</span>
      <button type="button" class="order-progress-return" hidden>Volver ${preview ? 'al documento' : kind === 'quote' ? 'a la cotización' : 'al pedido'}</button>
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
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function stop() { if (timer !== null) win.clearInterval(timer); timer = null; }
  function resetWait() {
    stageStarted = Date.now(); wait.hidden = true; clock.hidden = true;
    wait.textContent = preview
      ? 'Esto está tardando más de lo habitual. No cierres la ventana; sigo esperando esta misma preparación.'
      : `Google todavía no confirma esta etapa. No vuelvas a pulsar Guardar; sigo con la misma ${kind === 'quote' ? 'emisión' : 'operación'} para evitar duplicados.`;
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
        if (Date.now() - stageStarted >= 15000) { wait.hidden = false; clock.hidden = false; }
      }, 1000);
    }
  }
  function hide() {
    stop(); busy = false;
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    if (previousFocus?.isConnected && !previousFocus.disabled) previousFocus.focus({ preventScroll: true });
  }
  function begin() {
    if (destroyed) return;
    stop(); clock.textContent = ''; active = ''; numberNode.hidden = true; numberNode.textContent = ''; resetWait();
    message.textContent = support.prepare; caption.textContent = 'Revisión comercial en curso.';
    for (const [id, label, detail] of steps) {
      const row = dialog.querySelector(`[data-progress-step="${id}"]`);
      row.dataset.state = 'pending'; row.removeAttribute('aria-current'); row.setAttribute('aria-label', label + ': Pendiente');
      dialog.querySelector(`[data-progress-segment="${id}"]`).dataset.state = 'pending';
      row.querySelector('.order-progress-icon').textContent = '·'; row.querySelector('small').textContent = detail; row.querySelector('.order-progress-state').textContent = 'Pendiente';
    }
    title.textContent = headlines.prepare; open();
  }
  function update(event) {
    if (destroyed) return;
    const entry = steps.find(([id]) => id === event?.step);
    if (!entry || !['running', 'complete', 'skipped'].includes(event.status)) return;
    const row = dialog.querySelector(`[data-progress-step="${event.step}"]`); open();
    if (event.status === 'running') {
      if (active !== event.step) resetWait(); active = event.step;
      dialog.querySelectorAll('[aria-current]').forEach(node => node.removeAttribute('aria-current')); row.setAttribute('aria-current', 'step');
      setText(title, headlines[event.step]); setText(caption, `Paso ${steps.indexOf(entry) + 1} de ${steps.length} · ${entry[1]}`); setText(message, support[event.step]);
    }
    row.dataset.state = event.status; row.setAttribute('aria-label', entry[1] + ': ' + STATE_LABELS[event.status]);
    dialog.querySelector(`[data-progress-segment="${event.step}"]`).dataset.state = event.status;
    if (event.status !== 'running') row.removeAttribute('aria-current');
    row.querySelector('.order-progress-icon').textContent = event.status === 'complete' ? '✓' : event.status === 'skipped' ? '—' : '·';
    setText(row.querySelector('.order-progress-state'), STATE_LABELS[event.status]); if (event.detail) setText(row.querySelector('small'), event.detail);
    if (event.status === 'skipped' && event.step === 'photos') setText(message, kind === 'quote' ? 'Esta cotización no lleva referencias fotográficas; continúo sin crear un anexo.' : 'Este pedido no lleva referencias fotográficas; continúo directamente con su documento.');
    if (!preview && event.step === 'record' && event.number && event.status === 'complete') {
      setText(numberNode, (kind === 'quote' ? 'Cotización ' : 'Pedido ') + String(event.number).slice(0, 100)); numberNode.hidden = false;
    }
  }
  function pause(value) {
    if (!dialog.open || destroyed) return;
    stop(); busy = false; dialog.dataset.mode = 'paused'; live.textContent = 'Por confirmar';
    const entry = steps.find(([id]) => id === active); const row = entry && dialog.querySelector(`[data-progress-step="${active}"]`);
    if (row && row.dataset.state === 'running') {
      row.dataset.state = 'unconfirmed'; row.removeAttribute('aria-current'); row.setAttribute('aria-label', entry[1] + ': Sin confirmar');
      dialog.querySelector(`[data-progress-segment="${active}"]`).dataset.state = 'unconfirmed'; row.querySelector('.order-progress-icon').textContent = '!'; row.querySelector('.order-progress-state').textContent = 'Sin confirmar';
    }
    title.textContent = preview ? 'No pude confirmar la vista previa todavía.' : 'La operación necesita una comprobación.';
    message.textContent = value || 'No se confirmó el resultado.';
    caption.textContent = preview ? 'Tu formulario sigue intacto.' : `Conservo la misma ${kind === 'quote' ? 'emisión' : 'operación'} para no duplicar la venta.`;
    wait.textContent = preview ? 'Vuelve al documento y revisa el aviso. No se ha emitido ninguna venta.' : `Vuelve ${kind === 'quote' ? 'a la cotización' : 'al pedido'} para consultar o retomar este mismo intento. No crees ${kind === 'quote' ? 'otra cotización' : 'otra orden'}.`;
    wait.hidden = false; close.hidden = false; close.focus({ preventScroll: true });
  }
  function sync(state) {
    if (destroyed) return;
    if (state.phase === 'confirmed') {
      title.textContent = preview ? 'Documento listo para tu revisión.' : kind === 'quote' ? 'Cotización emitida. Todo quedó en su lugar.' : 'Orden registrada. Todo quedó en su lugar.'; hide();
    } else if (state.phase === 'checking') {
      begin(); update({ step: preview ? 'verify' : 'record', status: 'running' });
    } else if (['uncertain', 'retry', 'blocked', 'other-tab', 'rejected', 'disabled'].includes(state.phase) || state.phase === 'documents' && !state.working) pause(state.message || 'No se confirmó el resultado.');
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) hide(); }); close.addEventListener('click', hide); win.addEventListener('pagehide', stop);
  return { begin, update, pause, sync, destroy() { hide(); destroyed = true; dialog.remove(); win.removeEventListener('pagehide', stop); } };
}

export function createOrderProgress(doc = document) { return createDocumentProgress({ kind: 'order', mode: 'save' }, doc); }
