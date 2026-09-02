import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { escapeHtml, money, statusTone, humanizeCode } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardPage } from '../core/page-guard.js';
import { emptyState, errorState, loadingState } from '../core/ui.js';

const state = { items: [] };

async function requestData(payload) {
  const preview = previewApiData('CLIENTES_LISTAR');
  if (preview) return preview;
  try {
    return await apiRequest('CLIENTES_LISTAR', payload);
  } catch (error) {
    if (error?.code !== 'ACTION_NOT_FOUND') throw error;
    const system = await apiRequest('SISTEMA_ESTADO');
    if (Number(system.data?.counts?.clients || 0) !== 0) throw error;
    return { status: 'success', data: { items: [], total: 0, limit: Number(payload.limit || 100) } };
  }
}

function clientUrl(document) {
  return withPreview(`/cliente.html?id=${encodeURIComponent(document || '')}`);
}

function statusLabel(status) {
  const value = humanizeCode(status || 'ACTIVO');
  return `<span class="status-badge ${statusTone(status || 'ACTIVO')}">${escapeHtml(value)}</span>`;
}

function renderRows(items) {
  return items.map(item => `<tr data-client-url="${escapeHtml(clientUrl(item.document))}" tabindex="0" aria-label="Abrir cliente ${escapeHtml(item.name || item.document)}">
    <td><div class="client-name"><strong>${escapeHtml(item.name || 'Sin nombre')}</strong><span>${escapeHtml(`${item.documentType || 'Documento'} · ${item.document || '—'}`)}</span></div></td>
    <td>${escapeHtml(item.phone || '—')}</td>
    <td>${escapeHtml(item.city || '—')}</td>
    <td>${escapeHtml(item.branch || '—')}</td>
    <td>${escapeHtml(String(item.orderCount || 0))}</td>
    <td class="client-balance">${escapeHtml(money(item.balance || 0))}</td>
    <td>${statusLabel(item.status)}</td>
  </tr>`).join('');
}

function renderCards(items) {
  return items.map(item => `<a class="client-card" href="${escapeHtml(clientUrl(item.document))}">
    <span class="client-card-head"><span><strong>${escapeHtml(item.name || 'Sin nombre')}</strong><span>${escapeHtml(`${item.documentType || 'Documento'} · ${item.document || '—'}`)}</span></span>${statusLabel(item.status)}</span>
    <span class="client-card-contact"><span>${escapeHtml(item.phone || 'Sin teléfono')}</span><span>${escapeHtml([item.city, item.branch].filter(Boolean).join(' · ') || 'Sin sede')}</span></span>
    <span class="client-card-summary"><span>${escapeHtml(`${item.orderCount || 0} ${(item.orderCount || 0) === 1 ? 'orden' : 'órdenes'}`)}</span><strong>${escapeHtml(money(item.balance || 0))} pendiente</strong></span>
  </a>`).join('');
}

function bindRows() {
  document.querySelectorAll('[data-client-url]').forEach(row => {
    const open = () => window.location.assign(row.dataset.clientUrl);
    row.addEventListener('click', open);
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function updateList(items, total = items.length) {
  const result = document.getElementById('clients-result');
  const count = document.getElementById('clients-count');
  count.textContent = `${total} ${total === 1 ? 'cliente' : 'clientes'}`;

  if (!items.length) {
    result.innerHTML = emptyState({
      icon: 'CL',
      title: 'Todavía no hay clientes',
      message: 'Los clientes registrados en Maderarte aparecerán aquí.'
    });
    return;
  }

  result.innerHTML = `<div class="desktop-only client-list-surface"><table class="client-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Ciudad</th><th>Sede</th><th>Órdenes</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>${renderRows(items)}</tbody></table></div><div class="mobile-only client-card-list">${renderCards(items)}</div>`;
  bindRows();
}

async function searchClients() {
  const result = document.getElementById('clients-result');
  const payload = {
    query: document.getElementById('client-search').value.trim(),
    branch: document.getElementById('client-branch').value,
    status: document.getElementById('client-status').value,
    limit: 100
  };

  result.innerHTML = loadingState('Consultando clientes');
  try {
    const response = await requestData(payload);
    state.items = Array.isArray(response.data?.items) ? response.data.items : [];
    updateList(state.items, Number(response.data?.total ?? state.items.length));
  } catch (error) {
    result.innerHTML = errorState(error.message, error.requestId);
  }
}

guardPage({
  permission: 'clientes.read',
  activeKey: 'clientes',
  title: 'Clientes',
  subtitle: 'Directorio comercial de Maderarte.',
  async render({ content }) {
    content.innerHTML = `<section class="page">
      <div class="page-header"><div class="page-heading"><h1>Clientes</h1><p>Encuentra rápidamente a una persona por nombre, identificación, teléfono, correo, ciudad o sede.</p></div><div class="page-actions"><span class="status-badge info" id="clients-count">0 clientes</span></div></div>
      <form class="workspace-toolbar" id="clients-filter">
        <div class="field"><label for="client-search">Buscar</label><input id="client-search" type="search" placeholder="Nombre, identificación, teléfono o correo" autocomplete="off"></div>
        <div class="field"><label for="client-branch">Sede</label><select id="client-branch"><option value="">Todas</option><option value="MP">Principal</option><option value="TP">Terraplaza</option></select></div>
        <div class="field"><label for="client-status">Estado</label><select id="client-status"><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></div>
        <button class="button secondary" type="submit">Buscar</button>
      </form>
      <div id="clients-result">${loadingState('Consultando clientes')}</div>
    </section>`;

    document.getElementById('clients-filter').addEventListener('submit', event => {
      event.preventDefault();
      searchClients();
    });

    await searchClients();
  }
});
