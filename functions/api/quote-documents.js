// Server-side quote PDF pipeline. The browser supplies only the confirmed quote
// number; Apps Script supplies the immutable document projection.
const ORIGIN = 'https://app.maderartepopayan.com';
const NUMBER = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{4,}$/;
const fail = (code, message) => Object.assign(new Error(message), { code, status: 503 });
export const quoteBrowserReady = env => typeof env.BROWSER?.quickAction === 'function';
export function quotePdfOptions(document) {
  return {
    url: `${ORIGIN}/cotizacion-render.html`, cacheTTL: 0, bestAttempt: false,
    gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    addScriptTag: [{ id: 'maddy-document-data', type: 'application/json', content: JSON.stringify(document) }],
    waitForSelector: { selector: '[data-document-ready="true"]', timeout: 30000 },
    allowRequestPattern: [`^${ORIGIN.replaceAll('.', '\\.')}\/(?:cotizacion-render\\.html|(?:assets|css|js)\/[^?#]*)(?:\\?[^#]*)?$`, '^data:image\\/(?:png|jpeg|webp);base64,'],
    rejectResourceTypes: ['xhr', 'fetch', 'websocket', 'eventsource'],
    viewport: { width: 1120, height: 1200, deviceScaleFactor: 1 },
    pdfOptions: { format: 'a4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: false, margin: { top: '0', right: '0', bottom: '0', left: '0' } }
  };
}
function base64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 24576) result += btoa(String.fromCharCode(...bytes.subarray(i, i + 24576)));
  return result;
}
export async function finalizeQuoteDocuments(number, env, upstream) {
  if (typeof number !== 'string' || !NUMBER.test(number)) throw fail('QUOTE_NUMBER_INVALID', 'Selecciona una cotización válida.');
  if (!quoteBrowserReady(env)) throw fail('PDF_ENGINE_NOT_READY', 'Falta comprobar el motor de PDF. La cotización se conserva sin duplicarse.');
  const prepared = await upstream('INTERNO_COTIZACION_DOCUMENTO_PREPARAR', { number });
  if (prepared?.complete === true && prepared.number === number) return prepared;
  if (prepared?.complete !== false || prepared.number !== number || !prepared.id || !/^[a-f0-9]{64}$/.test(prepared.planHash || '')
    || prepared.document?.kind !== 'quote' || prepared.document?.number !== number || prepared.document?.issued !== true) {
    throw fail('DOCUMENT_PLAN_INVALID', 'El servidor no confirmó la versión de la cotización.');
  }
  const response = await env.BROWSER.quickAction('pdf', quotePdfOptions(prepared.document));
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw fail('PDF_RENDER_FAILED', 'No se pudo generar el PDF. Conservamos la cotización y las referencias para reintentar.');
  if (Number(response.headers.get('content-length')) > 12000000) throw fail('PDF_TOO_LARGE', 'El PDF supera el límite de almacenamiento.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 5 || bytes.length > 12000000 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw fail('PDF_RENDER_FAILED', 'El motor no entregó un PDF válido.');
  const result = await upstream('INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR', { number, id: prepared.id, planHash: prepared.planHash, base64: base64(bytes) });
  if (result?.complete !== true || result.number !== number) throw fail('DOCUMENT_CONFIRMATION_PENDING', 'Falta confirmar el archivo. Consulta la misma cotización, sin emitir otra.');
  return result;
}
