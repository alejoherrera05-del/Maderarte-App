const TEXT = {
  shellDescription: 'Prepara y registra los pagos de esta quincena, una persona a la vez.',
  runQuestion: '¿Qué quincena quieres pagar?',
  runHelp: 'Elige el período. Después Maddy te lleva persona por persona.',
};

function sameText(node, expected) {
  return Boolean(node) && node.textContent.trim() === expected;
}

function setText(node, value) {
  if (node && node.textContent.trim() !== value) node.textContent = value;
}

function setFirstTextNode(label, value) {
  if (!label) return;
  const node = [...label.childNodes].find((item) => item.nodeType === Node.TEXT_NODE && item.nodeValue.trim());
  if (node) {
    if (node.nodeValue.trim() !== value) node.nodeValue = value;
    return;
  }
  const span = document.createElement('span');
  span.className = 'np-friendly-label';
  span.textContent = value;
  label.prepend(span);
}

function setButton(button, label, arrow = false) {
  if (!button) return;
  const desired = arrow ? `${label} →` : label;
  if (button.textContent.replace(/\s+/g, ' ').trim() === desired) return;
  button.textContent = label;
  if (arrow) {
    button.append(' ');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '→';
    button.append(icon);
  }
}

function findExact(root, selector, text) {
  return [...root.querySelectorAll(selector)].find((node) => sameText(node, text));
}

function replaceExact(root, selector, from, to) {
  const node = findExact(root, selector, from);
  if (node) setText(node, to);
  return node;
}

function ensureSecondaryTools(root) {
  const wrap = root.querySelector('.np-wrap');
  const content = root.querySelector('#np-content');
  const footer = root.querySelector('.np-footer');
  if (!wrap || !content || !footer || wrap.classList.contains('np-settings-wrap')) return;

  let tools = root.querySelector('.np-friendly-tools');
  if (!tools) {
    tools = document.createElement('aside');
    tools.className = 'np-friendly-tools';
    tools.setAttribute('aria-label', 'Otras acciones de nómina');
    tools.innerHTML = '<span class="np-friendly-tools-label">Otras acciones</span><div class="np-friendly-tools-actions"></div>';
    footer.before(tools);
  }

  const slot = tools.querySelector('.np-friendly-tools-actions');
  const config = root.querySelector('.np-top .np-actions a[href*="configuracion.html"][href*="#nomina"]')
    || root.querySelector('.np-friendly-tools-actions a[href*="configuracion.html"][href*="#nomina"]');
  const newReceipt = root.querySelector('#np-new');
  if (config && config.parentElement !== slot) {
    setText(config, 'Configuración de nómina');
    config.classList.add('np-friendly-tool');
    slot.append(config);
  }
  if (newReceipt && newReceipt.parentElement !== slot) {
    setButton(newReceipt, 'Otro pago');
    newReceipt.classList.remove('dark');
    newReceipt.classList.add('np-friendly-secondary', 'np-friendly-tool');
    newReceipt.title = 'Prima, liquidación u otro comprobante fuera de la quincena normal';
    slot.append(newReceipt);
  }
  tools.hidden = slot.children.length === 0;
}

function enhanceShell(root) {
  const wrap = root.querySelector('.np-wrap');
  const settings = wrap?.classList.contains('np-settings-wrap');
  const top = root.querySelector('.np-top');
  const tabs = [...root.querySelectorAll('.np-tabs [data-tab]')];
  const active = tabs.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.tab || 'quincena';

  if (top && !settings) {
    const copy = {
      quincena: ['Pagos del equipo', 'Revisa lo pendiente y registra cada pago cuando ya lo hayas entregado.'],
      comprobantes: ['Historial de pagos', 'Consulta comprobantes y pagos anteriores sin mezclarlos con la quincena actual.'],
      comisiones: ['Comisiones', 'Revisa ventas pendientes y las comisiones que ya fueron incluidas en un pago.'],
    }[active] || ['Pagos del equipo', TEXT.shellDescription];

    const eyebrow = top.querySelector('.np-eyebrow');
    if (eyebrow) eyebrow.hidden = true;
    setText(top.querySelector('h1'), copy[0]);
    setText(top.querySelector('p'), copy[1]);
  }

  const newReceipt = root.querySelector('#np-new');
  if (newReceipt) {
    setButton(newReceipt, 'Otro pago');
    newReceipt.classList.remove('dark');
    newReceipt.classList.add('np-friendly-secondary');
    newReceipt.title = 'Prima, liquidación u otro comprobante fuera de la quincena normal';
  }

  const receipts = tabs.find((button) => button.dataset.tab === 'comprobantes');
  setText(receipts, 'Historial');
  ensureSecondaryTools(root);
}

function enhanceRunSummary(root) {
  const summary = root.querySelector('#np-run-result .np-summary');
  if (!summary) return;
  const labels = summary.querySelectorAll('small');
  labels.forEach((label) => {
    const value = label.textContent.trim();
    if (value.startsWith('Total previsto')) setText(label, value.replace('Total previsto', 'Total de la quincena'));
    if (value === 'Por registrar como pagado') setText(label, 'Pendiente');
    if (value === 'Pagos registrados') setText(label, 'Ya pagado');
  });
}

const RUN_STATE_LABELS = new Map([
  ['Revisar cobertura del período', 'Revisar fechas'],
  ['Por revisar', 'Falta revisar'],
  ['Borrador guardado', 'En revisión'],
  ['Revisado', 'Listo para confirmar'],
  ['Necesita revisión', 'Hay que revisar'],
  ['Listo para registrar pago', 'Listo para pagar'],
  ['Pago registrado', 'Pagado'],
]);

function enhanceRunPeople(root) {
  const list = root.querySelector('.np-run-people');
  if (!list) return;
  const cards = [...list.querySelectorAll(':scope > .np-run-person')];
  if (!cards.length) return;

  cards.forEach((card) => {
    const state = card.querySelector('.np-run-state');
    if (state) {
      const current = state.textContent.replace(/^✓\s*/, '').trim();
      const next = RUN_STATE_LABELS.get(current);
      if (next) setText(state, state.classList.contains('is-paid') ? `✓ ${next}` : next);
    }

    const button = card.querySelector(':scope > .np-button[data-run-person]');
    if (button) {
      const label = button.textContent.replace(/→/g, '').trim();
      if (label === 'Revisar pago') setButton(button, 'Preparar pago', true);
      else if (label === 'Continuar revisión') setButton(button, 'Continuar', true);
      else if (label === 'Confirmar comprobante') setButton(button, 'Revisar y dejar listo', true);
    }

    const paid = Boolean(state?.classList.contains('is-paid'));
    card.classList.toggle('np-friendly-paid', paid);
  });

  const ordered = [...cards].sort((a, b) => Number(a.classList.contains('np-friendly-paid')) - Number(b.classList.contains('np-friendly-paid')));
  if (ordered.some((card, index) => cards[index] !== card)) ordered.forEach((card) => list.append(card));
}

function enhanceRun(root) {
  const picker = root.querySelector('.np-run-picker');
  if (picker) {
    setText(picker.querySelector('h2'), TEXT.runQuestion);
    setText(picker.querySelector('p'), TEXT.runHelp);
  }

  const heading = root.querySelector('.np-run-heading');
  if (heading) {
    const progress = heading.querySelector('.np-run-progress');
    if (progress) progress.setAttribute('aria-label', `Progreso de pagos: ${progress.textContent.trim()}`);
  }

  enhanceRunSummary(root);

  const steps = root.querySelectorAll('.np-run-steps li');
  if (steps.length === 3) {
    steps[0].lastChild.nodeValue = ' Revisa a la persona';
    steps[1].lastChild.nodeValue = ' Confirma el total';
    steps[2].lastChild.nodeValue = ' Registra el pago';
  }

  enhanceRunPeople(root);

  const people = root.querySelector('.np-run-people');
  if (people) {
    let guide = root.querySelector('.np-friendly-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'np-friendly-guide';
      guide.innerHTML = '<strong></strong><span></span>';
      people.before(guide);
    }
    const pending = [...people.querySelectorAll(':scope > .np-run-person')].filter((card) => !card.classList.contains('np-friendly-paid')).length;
    setText(guide.querySelector('strong'), pending ? `${pending} pago${pending === 1 ? '' : 's'} por completar` : 'Quincena al día');
    setText(guide.querySelector('span'), pending ? 'Empieza por la primera persona pendiente. Maddy te guía paso a paso.' : 'Todos los pagos de esta quincena están registrados.');
  }

  const help = root.querySelector('.np-run-help');
  setText(help, 'Maddy solo registra lo que ya pagaste. No hace transferencias ni mueve dinero.');
}

function setChoiceState(form, state) {
  form.dataset.friendlyAttendance = state;
  const panel = form.querySelector('.np-friendly-attendance-question');
  if (!panel) return;
  panel.querySelectorAll('[data-friendly-attendance]').forEach((button) => {
    const selected = button.dataset.friendlyAttendance === state;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const helper = panel.querySelector('.np-friendly-choice-help');
  setText(helper, state === 'complete'
    ? 'Perfecto. Se usarán todos los días de esta quincena.'
    : state === 'changes'
      ? 'Cuéntale a Maddy únicamente qué cambió.'
      : 'Elige una opción para continuar.');
}

function dispatchInput(input) {
  input.dispatchEvent(new Event('input', {bubbles: true}));
  input.dispatchEvent(new Event('change', {bubbles: true}));
}

function attendanceTotal(form) {
  const worked = Number(form.elements.workedDays?.value || 0);
  const absent = Number(form.elements.absent?.value || 0);
  const max = Number(form.elements.workedDays?.max || 0);
  return max || worked + absent || 15;
}

function chooseFullPeriod(form) {
  const worked = form.elements.workedDays;
  const absent = form.elements.absent;
  if (!worked || !absent) return;
  worked.value = String(attendanceTotal(form));
  absent.value = '0';
  dispatchInput(worked);
  if (form.elements.absenceReason) form.elements.absenceReason.value = '';
  if (form.elements.noveltyType) {
    form.elements.noveltyType.value = 'NINGUNA';
    dispatchInput(form.elements.noveltyType);
  }
  setChoiceState(form, 'complete');
  updateFriendlyAttendance(form);
}

function chooseChanges(form) {
  setChoiceState(form, 'changes');
  updateFriendlyAttendance(form);
  const absent = form.elements.absent;
  if (absent) requestAnimationFrame(() => absent.focus());
}

function ensureAttendanceQuestion(form) {
  if (form.querySelector('.np-friendly-attendance-question')) return;
  const concepts = form.querySelector('#np-concepts');
  if (!concepts || !form.elements.workedDays) return;

  const panel = document.createElement('section');
  panel.className = 'np-friendly-question np-friendly-attendance-question';
  panel.innerHTML = `
    <span class="np-friendly-step">1 · Días de esta quincena</span>
    <h3>¿Trabajó normalmente toda esta quincena?</h3>
    <p>Si todo fue normal, no tienes que llenar días ni hacer cálculos.</p>
    <div class="np-friendly-choices">
      <button class="np-friendly-choice" type="button" data-friendly-attendance="complete" aria-pressed="false">Sí, trabajó completa</button>
      <button class="np-friendly-choice" type="button" data-friendly-attendance="changes" aria-pressed="false">No, hubo una novedad</button>
    </div>
    <p class="np-friendly-choice-help" role="status">Elige una opción para continuar.</p>`;
  concepts.before(panel);

  panel.querySelector('[data-friendly-attendance="complete"]').addEventListener('click', () => chooseFullPeriod(form));
  panel.querySelector('[data-friendly-attendance="changes"]').addEventListener('click', () => chooseChanges(form));

  const hasChanges = Number(form.elements.absent?.value || 0) > 0 ||
    (form.elements.noveltyType && form.elements.noveltyType.value !== 'NINGUNA');
  if (hasChanges) setChoiceState(form, 'changes');
}

function updateFriendlyAttendance(form) {
  const concepts = form.querySelector('#np-concepts');
  const worked = form.elements.workedDays;
  const absent = form.elements.absent;
  if (!concepts || !worked || !absent) return;

  ensureAttendanceQuestion(form);

  const grid = worked.closest('.np-grid');
  const workedLabel = worked.closest('label');
  const absentLabel = absent.closest('label');
  const summary = form.querySelector('#np-days-summary');
  const absenceReason = form.querySelector('#np-absence-label');
  const novelty = form.elements.noveltyType?.closest('details');
  const immediateHint = [...concepts.children].find((node) => node.classList?.contains('np-hint')) || null;
  const mode = form.dataset.friendlyAttendance || '';
  const hideDetails = mode !== 'changes';

  if (grid) grid.classList.toggle('np-friendly-hidden', hideDetails);
  if (workedLabel) workedLabel.classList.add('np-friendly-hidden');
  if (absentLabel) setFirstTextNode(absentLabel, '¿Cuántos días no se pagarán?');
  if (summary) summary.classList.toggle('np-friendly-hidden', hideDetails);
  if (immediateHint) immediateHint.classList.toggle('np-friendly-hidden', hideDetails);
  if (absenceReason) absenceReason.classList.toggle('np-friendly-hidden', hideDetails || Number(absent.value) === 0);
  if (novelty) novelty.classList.toggle('np-friendly-hidden', hideDetails);

  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = !mode;
    setButton(submit, 'Ver total a pagar', true);
  }
}

function enhanceRunComposer(root, dialog) {
  const form = dialog.querySelector('#np-form');
  if (!form || !form.elements.workedDays) return;
  const title = root.querySelector('#np-title')?.textContent.trim() || '';
  const fromRun = title.startsWith('Revisar a ');
  if (!fromRun) {
    const submit = form.querySelector('button[type="submit"]');
    if (submit && sameText(submit, 'Revisar desglose')) setButton(submit, 'Ver total a pagar', true);
    return;
  }

  form.classList.add('np-friendly-form');
  updateFriendlyAttendance(form);

  const extra = form.querySelector('.np-extra-details > summary');
  setText(extra, '¿Hay anticipos u otros ajustes?');
  if (extra?.parentElement && !extra.parentElement.querySelector('.np-friendly-details-help')) {
    const help = document.createElement('p');
    help.className = 'np-friendly-details-help';
    help.textContent = 'Ábrelo solo si necesitas sumar o descontar algo.';
    extra.after(help);
  }

  [...form.querySelectorAll('.np-novelties > summary')].forEach((summary) => {
    if (summary.textContent.trim().startsWith('Comisiones pendientes')) {
      const count = summary.textContent.match(/·\s*(\d+)/)?.[1];
      setText(summary, `¿Hay comisiones pendientes?${count ? ` · ${count}` : ''}`);
    }
  });

  const save = form.querySelector('#np-save-draft');
  setButton(save, 'Guardar para después');
}

function enhanceReview(root, dialog) {
  const title = root.querySelector('#np-title');
  if (!sameText(title, 'Revisar comprobante')) return false;
  const employee = dialog.querySelector('.np-period strong')?.textContent.trim();
  if (employee) setText(title, `Este es el pago de ${employee}`);

  const totalLabel = dialog.querySelector('.np-total span');
  setText(totalLabel, 'Total a pagar');

  const hint = [...dialog.querySelectorAll('.np-hint')].find((node) => node.textContent.trim().startsWith('Al emitir se reservarán'));
  setText(hint, 'Al confirmar, este pago quedará listo para registrarlo cuando entregues el dinero.');

  setButton(dialog.querySelector('#np-back'), 'Corregir algo');
  setButton(dialog.querySelector('#np-save-review'), 'Guardar para después');
  setButton(dialog.querySelector('#np-issue'), 'Está correcto', true);

  if (!dialog.querySelector('.np-friendly-review-help')) {
    const note = document.createElement('p');
    note.className = 'np-friendly-review-help';
    note.textContent = 'Revisa el total y sus conceptos. Si algo no coincide, puedes volver y corregirlo.';
    dialog.querySelector('.np-period')?.before(note);
  }
  return true;
}

function focusNextPending(root, dialog) {
  dialog.close();
  const next = [...root.querySelectorAll('.np-run-person')].find((card) => !card.classList.contains('np-friendly-paid'));
  if (!next) return;
  next.scrollIntoView({behavior: 'smooth', block: 'center'});
  setTimeout(() => next.querySelector('[data-run-person]')?.focus(), 350);
}

function enhanceReceipt(root, dialog) {
  const badge = dialog.querySelector('.np-badge');
  if (!badge) return;
  const status = badge.textContent.trim();
  if (status === 'Pendiente de pago') setText(badge, 'Listo para pagar');

  setButton(dialog.querySelector('#np-pdf'), 'Ver / guardar comprobante');
  setButton(dialog.querySelector('#np-void'), 'Anular comprobante');
  setButton(dialog.querySelector('#np-pay'), 'Registrar pago', true);

  if (badge.textContent.trim() === 'Pagado') {
    if (!dialog.querySelector('.np-friendly-success')) {
      const success = document.createElement('div');
      success.className = 'np-friendly-success';
      success.innerHTML = '<strong>✓ Pago registrado</strong><span>Este pago ya quedó guardado en Maddy.</span>';
      dialog.querySelector('.np-period')?.before(success);
    }
    const actions = dialog.querySelector('.np-actions');
    const hasPending = [...root.querySelectorAll('.np-run-person')].some((card) => !card.classList.contains('np-friendly-paid'));
    if (actions && hasPending && !dialog.querySelector('#np-friendly-next')) {
      const next = document.createElement('button');
      next.type = 'button';
      next.id = 'np-friendly-next';
      next.className = 'np-button primary';
      next.textContent = 'Continuar con el siguiente →';
      next.addEventListener('click', () => focusNextPending(root, dialog));
      actions.append(next);
    }
  }
}

function enhancePaymentDialog(root, dialog) {
  const title = root.querySelector('#np-title');
  if (!sameText(title, 'Registrar pago realizado')) return;
  const form = dialog.querySelector('#np-form');
  if (!form) return;

  const method = form.elements.method;
  if (method) setFirstTextNode(method.closest('label'), '¿Cómo pagaste?');
  const reference = form.elements.reference;
  if (reference) setFirstTextNode(reference.closest('label'), 'Referencia (opcional)');
  setButton(form.querySelector('button[type="submit"]'), 'Registrar pago ✓');

  if (!form.querySelector('.np-friendly-payment-note')) {
    const note = document.createElement('p');
    note.className = 'np-friendly-payment-note';
    note.textContent = 'Maddy solo deja constancia del pago. No hace transferencias ni mueve dinero.';
    form.querySelector('.np-check')?.before(note);
  }
}

function enhanceDialog(root) {
  const dialog = root.querySelector('#np-dialog');
  if (!dialog?.open) return;

  enhanceRunComposer(root, dialog);
  if (enhanceReview(root, dialog)) return;
  enhancePaymentDialog(root, dialog);
  enhanceReceipt(root, dialog);
}

function enhanceHistory(root) {
  root.querySelectorAll('.np-badge').forEach((badge) => {
    if (badge.textContent.trim() === 'Pendiente de pago') setText(badge, 'Listo para pagar');
  });
}

export function enhancePayrollFriendlyUx(root) {
  if (!root) return;
  root.classList.add('np-friendly');
  enhanceShell(root);
  enhanceRun(root);
  enhanceHistory(root);
  enhanceDialog(root);
}

export function installPayrollFriendlyUx(root) {
  if (!root) return () => {};
  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhancePayrollFriendlyUx(root);
    });
  };
  const observer = new MutationObserver(run);
  observer.observe(root, {childList: true, subtree: true});
  run();
  return () => observer.disconnect();
}
