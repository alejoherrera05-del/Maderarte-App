import { escapeHtml, humanizeCode, statusTone, text } from './format.js';

export function setText(id, value, fallback = '—') {
  const element = document.getElementById(id);
  if (element) element.textContent = text(value, fallback);
}

export function statusBadge(value) {
  const label = humanizeCode(value);
  return `<span class="status-badge ${statusTone(value)}">${escapeHtml(label)}</span>`;
}

export function emptyState({ icon = 'MA', title = 'Sin información', message = 'Todavía no hay registros para mostrar.' } = {}) {
  return `<div class="empty-state"><div class="empty-state-inner"><div class="empty-icon">${escapeHtml(icon)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></div>`;
}

export function loadingState(message = 'Cargando información…') {
  return `<div class="empty-state" aria-live="polite"><div class="empty-state-inner"><div class="empty-icon">···</div><h2>${escapeHtml(message)}</h2><p>Estamos consultando la fuente oficial.</p></div></div>`;
}

export function errorState(message, requestId = '') {
  const suffix = requestId ? ` Código de seguimiento: ${requestId}.` : '';
  return emptyState({ icon: '!', title: 'No pudimos cargar esta sección', message: `${message}${suffix}` });
}

export function toast(message, tone = 'info') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const item = document.createElement('div');
  item.className = `toast ${tone}`;
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 4_500);
}

export function setBusy(button, busy, busyText = 'Procesando…') {
  if (!button) return;
  if (busy) {
    button.dataset.previousText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.previousText || button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
