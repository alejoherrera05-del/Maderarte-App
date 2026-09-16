// Progress follows confirmed service responses; no timers or invented percentages.
export function renderSaveFeedback(root, button, state, idleLabel) {
  const active = ['preparing', 'saving', 'checking'].includes(state.phase) || state.working === true;
  button.textContent = active ? (state.phase === 'preparing' ? 'Preparando…' : state.phase === 'documents' ? 'Completando PDF…' : 'Confirmando…') : idleLabel;
  button.setAttribute('aria-busy', String(active));
  root.replaceChildren();
  root.classList.add('commercial-save-feedback');
  root.dataset.active = String(active);
  if (['ready', 'new', 'disabled'].includes(state.phase)) return;
  const message = document.createElement('p');
  message.className = 'commercial-save-message';
  message.textContent = state.message;
  root.append(message);
  if (state.number) {
    const number = document.createElement('strong');
    number.className = 'commercial-save-number'; number.textContent = state.number;
    root.append(number);
  }
  if (!active && state.phase !== 'confirmed') return;
  const steps = document.createElement('ol'); steps.className = 'commercial-save-steps';
  steps.setAttribute('aria-label', 'Avance del guardado');
  const current = state.phase === 'confirmed' ? 3 : state.phase === 'documents' ? 2 : ['saving','checking'].includes(state.phase) ? 1 : 0;
  ['Preparar', 'Registrar', 'Archivar PDF'].forEach((label, i) => {
    const step = document.createElement('li'); step.textContent = label;
    if (i < current) { step.dataset.complete = 'true'; step.setAttribute('aria-label', label + ': completado'); }
    if (i === current) step.setAttribute('aria-current', 'step');
    steps.append(step);
  });
  root.append(steps);
}
