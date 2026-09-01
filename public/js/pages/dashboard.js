import { apiRequest } from '../core/api.js';
import { previewApiData } from '../core/auth.js';
import { money, escapeHtml } from '../core/format.js';
import { withPreview } from '../core/config.js';
import { guardPage } from '../core/page-guard.js';
import { emptyState, errorState, loadingState } from '../core/ui.js';

async function loadData() {
  return previewApiData('DASHBOARD_RESUMEN') || apiRequest('DASHBOARD_RESUMEN');
}

guardPage({
  permission: 'app.access',
  activeKey: 'inicio',
  title: 'Centro de operaciones',
  subtitle: 'Estado actual de la operación registrada en Maderarte App.',
  async render({ session, content }) {
    content.innerHTML = `<section class="page">
      <div class="page-header"><div class="page-heading"><h1>Hola, ${escapeHtml(session.profile.name || 'equipo Maderarte')}</h1><p>Esta fundación empieza con una base comercial vacía. Aquí aparecerá únicamente lo creado desde la nueva app.</p></div><div class="page-actions"><a class="button primary" href="${escapeHtml(withPreview('/ordenes.html'))}">Ver órdenes</a></div></div>
      <div id="dashboard-body">${loadingState('Consultando la operación')}</div>
    </section>`;

    const body = document.getElementById('dashboard-body');
    try {
      const response = await loadData();
      const metrics = response.data?.metrics || {};
      const priorities = Array.isArray(response.data?.priorities) ? response.data.priorities : [];
      body.innerHTML = `
        <div class="metric-strip">
          <article class="metric"><span>Órdenes activas</span><strong>${Number(metrics.activeOrders || 0)}</strong><small>Confirmadas o en proceso</small></article>
          <article class="metric"><span>Saldo pendiente</span><strong>${money(metrics.pendingBalance || 0)}</strong><small>Por cobrar en órdenes activas</small></article>
          <article class="metric"><span>Producción pendiente</span><strong>${Number(metrics.pendingProduction || 0)}</strong><small>Aún no listas para entrega</small></article>
          <article class="metric"><span>Listas para entregar</span><strong>${Number(metrics.readyDelivery || 0)}</strong><small>Producción terminada</small></article>
        </div>
        <div class="content-grid">
          <section class="card panel"><div class="panel-header"><h2>Prioridades</h2><a href="${escapeHtml(withPreview('/ordenes.html'))}">Abrir ledger</a></div><div class="priority-list">${priorities.length ? priorities.map(item => `<a class="priority-row" href="${escapeHtml(withPreview(`/orden.html?op=${encodeURIComponent(item.number || '')}`))}"><span class="status-badge warning">${escapeHtml(item.label || 'Pendiente')}</span><span class="priority-copy"><strong>${escapeHtml(item.number || 'Orden')}</strong><span>${escapeHtml(item.client || '')}</span></span></a>`).join('') : emptyState({ icon: '0', title: 'Sin prioridades', message: 'No hay órdenes registradas todavía.' })}</div></section>
          <aside class="stack"><section class="card panel"><div class="panel-header"><h2>Estado del sistema</h2></div><div class="key-value-grid"><div class="key-value"><span>Versión</span><strong>0.2.0</strong></div><div class="key-value"><span>Modo</span><strong>${escapeHtml(response.data?.mode || 'PREPARACION')}</strong></div><div class="key-value"><span>Datos comerciales</span><strong>Base Cero</strong></div><div class="key-value"><span>Escrituras</span><strong>Deshabilitadas</strong></div></div></section></aside>
        </div>`;
    } catch (error) {
      body.innerHTML = errorState(error.message, error.requestId);
    }
  }
});
