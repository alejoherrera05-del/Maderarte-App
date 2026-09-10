import { sandboxLink } from './order-sandbox-context.js';

export function orderReturnPath(number, item = new URLSearchParams(window.location.search).get('op') === number ? new URLSearchParams(window.location.search).get('item') : '') {
  const params = new URLSearchParams({ op: number });
  if (item && item.length <= 180) params.set('item', item);
  return sandboxLink('/orden.html?' + params);
}

// Only UI context travels in the URL. The server remains the source of order data.
export function createOrderFlow({ cover, workflow, label }) {
  const params = new URLSearchParams(window.location.search), number = params.get('op');
  if (!number) return { ready() {}, fail() {}, sync() {}, clear() {} };
  cover.hidden = true; workflow.hidden = false; workflow.classList.add('order-flow-loading');
  const nav = document.createElement('section'); nav.className = 'order-flow-context';
  const back = document.createElement('a'); back.href = orderReturnPath(number); back.textContent = 'Volver a la OP';
  const trail = document.createElement('p'); trail.textContent = `${number} / ${label}`;
  const status = document.createElement('p'); status.className = 'order-flow-status'; status.setAttribute('role', 'status'); status.textContent = 'Cargando los muebles de esta orden…';
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Volver a intentar'; retry.hidden = true;
  retry.addEventListener('click', () => window.location.reload());
  nav.append(back, trail, status, retry); workflow.querySelector('header')?.after(nav);
  function sync() {
    const button = workflow.querySelector('header a');
    if (button) { button.href = orderReturnPath(number); button.setAttribute('aria-label', 'Volver a la orden'); }
  }
  sync();
  return {
    sync,
    clear() { nav.hidden = true; workflow.classList.remove('order-flow-loading'); },
    ready() { workflow.classList.remove('order-flow-loading'); status.hidden = true; retry.hidden = true; sync(); },
    fail(message) { status.textContent = message || 'No se pudo cargar la orden.'; retry.hidden = false; }
  };
}
