import { guardStandalonePage } from '../core/page-guard.js';
import { apiRequest } from '../core/api.js?v=sandbox-1';
guardStandalonePage({ permission: 'config.read', async render() {
  const root = document.getElementById('document-diagnostic'); root.hidden = false;
  const button = document.getElementById('run-document-diagnostic');
  const result = document.getElementById('document-diagnostic-result');
  button.addEventListener('click', async () => {
    button.disabled = true; result.textContent = 'Comprobando la instalación y generando un PDF técnico sin datos comerciales…';
    try {
      const { data } = await apiRequest('SISTEMA_DOCUMENTOS_DIAGNOSTICO', {}, { timeoutMs: 150000 });
      result.replaceChildren();
      const fields = [['Cerebro', data.version], ['Esquema documental', data.schema ? 'Preparado' : 'Pendiente'],
        ['Drive API', data.drive ? 'Acceso comprobado' : 'Revisar permisos o servicio'],
        ['Motor de PDF', data.pdfEngine?.ok ? 'PDF técnico generado correctamente' : 'Pendiente: ' + (data.pdfEngine?.reason || 'Sin respuesta')],
        ['Modo', data.mode], ['Escritura comercial', data.commercialWrites ? 'Habilitada' : 'Deshabilitada'],
        ['Aceptación de extremo a extremo', 'Pendiente: esta comprobación no crea una venta']];
      for (const [label, value] of fields) { const node = document.createElement('div'); node.className = 'od-kv-item'; const title = document.createElement('span'), text = document.createElement('strong'); title.textContent = label; text.textContent = String(value || 'No informado'); node.append(title,text); result.append(node); }
    } catch (error) { result.textContent = error.message || 'No se pudo comprobar la instalación.'; }
    finally { button.disabled = false; }
  });
} });
