import { browserReady } from './order-documents.js';

const ORIGIN = 'https://app.maderartepopayan.com';
const fail = (code, message, status = 503) => Object.assign(new Error(message), { code, status });

function base64(bytes) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 24576) result += btoa(String.fromCharCode(...bytes.subarray(index, index + 24576)));
  return result;
}

function quotePdfOptions(document, origin = ORIGIN) {
  return {
    url: `${origin}/cotizacion-render.html`,
    cacheTTL: 0,
    bestAttempt: false,
    gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    addScriptTag: [{ id: 'maddy-document-data', type: 'application/json', content: JSON.stringify(document) }],
    waitForSelector: { selector: '[data-document-ready="true"]', timeout: 30000 },
    allowRequestPattern: [
      `^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/(?:cotizacion-render\\.html|(?:assets|css|js)\/[^?#]*)(?:\\?[^#]*)?$`,
      '^data:image\\/(?:png|jpeg|webp);base64,'
    ],
    rejectResourceTypes: ['xhr', 'fetch', 'websocket', 'eventsource'],
    viewport: { width: 1120, height: 1200, deviceScaleFactor: 1 },
    pdfOptions: {
      format: 'a4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    }
  };
}

export async function finalizeQuoteDocuments(number, env, upstream) {
  if (typeof number !== 'string' || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3,}$/.test(number)) {
    throw fail('QUOTE_NUMBER_INVALID', 'Selecciona una cotización válida.', 400);
  }
  if (!browserReady(env)) throw fail('PDF_ENGINE_NOT_READY', 'Falta comprobar el motor de PDF. La cotización se conserva sin duplicarse.');
  const prepared = await upstream('INTERNO_COTIZACION_DOCUMENTO_PREPARAR', { number });
  if (prepared?.complete === true && prepared.number === number) return prepared;
  if (prepared?.complete !== false || prepared.number !== number || !prepared.id || !/^[a-f0-9]{64}$/.test(prepared.planHash || '')
    || prepared.document?.number !== number || prepared.document?.issued !== true || prepared.document?.documentKind !== 'quote') {
    throw fail('QUOTE_DOCUMENT_PLAN_INVALID', 'El servidor no confirmó la versión de la cotización.');
  }
  let origin = ORIGIN;
  // Deployment-owned setting, never accepted from the browser payload. Only a
  // server-confirmed sandbox projection can use a pre-merge renderer.
  if (prepared.document.sandbox && env.QUOTE_SANDBOX_RENDER_ORIGIN) {
    const candidate = new URL(env.QUOTE_SANDBOX_RENDER_ORIGIN);
    if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.pathname !== '/' || candidate.search || candidate.hash) {
      throw fail('QUOTE_RENDER_ORIGIN_INVALID', 'Revisa el origen del renderizador del ensayo.');
    }
    origin = candidate.origin;
  }
  const response = await env.BROWSER.quickAction('pdf', quotePdfOptions(prepared.document, origin));
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
    throw fail('QUOTE_PDF_RENDER_FAILED', 'No se pudo generar el PDF. Conservamos la cotización y sus referencias para reintentar.');
  }
  if (Number(response.headers.get('content-length')) > 12000000) throw fail('QUOTE_PDF_TOO_LARGE', 'El PDF supera el límite de almacenamiento.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 5 || bytes.length > 12000000 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw fail('QUOTE_PDF_RENDER_FAILED', 'El motor no entregó un PDF válido.');
  }
  const result = await upstream('INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR', {
    number,
    id: prepared.id,
    planHash: prepared.planHash,
    base64: base64(bytes)
  });
  if (result?.complete !== true || result.number !== number) {
    throw fail('QUOTE_DOCUMENT_CONFIRMATION_PENDING', 'Falta confirmar el archivo. Consulta la misma cotización, sin crear otra.');
  }
  return result;
}
