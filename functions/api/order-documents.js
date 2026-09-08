// The client chooses an existing OP, NEVER the HTML, PDF bytes or rendering URL.
const ORIGIN = 'https://app.maderartepopayan.com';
const fail = (code, message) => Object.assign(new Error(message), { code, status: 503 });
export const browserReady = env => typeof env.BROWSER?.quickAction === 'function';
export function pdfOptions(document) {
  return {
    url: `${ORIGIN}/documento-render.html`, cacheTTL: 0, bestAttempt: false,
    gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    addScriptTag: [{ id: 'maddy-document-data', type: 'application/json', content: JSON.stringify(document) }],
    waitForSelector: { selector: '[data-document-ready="true"]', timeout: 30000 },
    allowRequestPattern: [`^${ORIGIN.replaceAll('.', '\\.')}\/(?:documento-render\\.html|(?:assets|css|js)\/[^?#]*)(?:\\?[^#]*)?$`, '^data:image\\/(?:png|jpeg|webp);base64,'],
    rejectResourceTypes: ['xhr', 'fetch', 'websocket', 'eventsource'],
    viewport: { width: 1120, height: 1200, deviceScaleFactor: 1 },
    pdfOptions: { ...(document.documentKind === 'receipt' ? { width: '8.5in', height: '5.5in' } : { format: 'a4' }), printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: false, margin: { top: '0', right: '0', bottom: '0', left: '0' } }
  };
}
function base64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 24576) result += btoa(String.fromCharCode(...bytes.subarray(i, i + 24576)));
  return result;
}
export async function finalizeOrderDocuments(number, env, upstream) {
  if (typeof number !== 'string' || !/^(?:MP|TP)-[A-Z0-9-]+-[0-9]+$/.test(number)) throw fail('ORDER_NUMBER_INVALID', 'Selecciona una orden válida.');
  if (!browserReady(env)) throw fail('PDF_ENGINE_NOT_READY', 'Falta comprobar el motor de PDF. La orden se conserva sin duplicarse.');
  const prepared = await upstream('INTERNO_DOCUMENTO_PREPARAR', { number });
  if (prepared?.complete === true && prepared.number === number) return prepared;
  if (prepared?.complete !== false || prepared.number !== number || !prepared.id || !/^[a-f0-9]{64}$/.test(prepared.planHash || '')
    || prepared.document?.number !== number || prepared.document?.issued !== true) throw fail('DOCUMENT_PLAN_INVALID', 'El servidor no confirmó la versión del documento.');
  const response = await env.BROWSER.quickAction('pdf', pdfOptions(prepared.document));
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw fail('PDF_RENDER_FAILED', 'No se pudo generar el PDF. Conservamos la orden y las referencias para reintentar.');
  if (Number(response.headers.get('content-length')) > 12000000) throw fail('PDF_TOO_LARGE', 'El PDF supera el límite de almacenamiento.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 5 || bytes.length > 12000000 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw fail('PDF_RENDER_FAILED', 'El motor no entregó un PDF válido.');
  const result = await upstream('INTERNO_DOCUMENTO_CONFIRMAR', { number, id: prepared.id, planHash: prepared.planHash, base64: base64(bytes) });
  if (result?.complete !== true || result.number !== number) throw fail('DOCUMENT_CONFIRMATION_PENDING', 'Falta confirmar el archivo. Consulta la misma orden, sin crear otra.');
  return result;
}

export async function probePdfEngine(env) {
  if (!browserReady(env)) return { ok: false, reason: 'BROWSER_BINDING_MISSING' };
  // No customer records, user input, session cookie or API token enter this probe.
  const sample = { issued: true, number: 'MP-QA-OP-0000', date: '2026-09-07T17:00:00Z', advisor: 'Prueba técnica', branchCode: 'MP',
    client: { document: '00000000', name: 'DIAGNÓSTICO — SIN VALIDEZ COMERCIAL', phone: '00000000', email: 'qa@example.invalid', address: 'Sin entrega', city: 'Prueba' },
    notes: 'Diagnóstico del motor. No es una venta ni crea registros.', subtotal: 100, discount: 0, total: 100,
    order: { paid: 0, balance: 100, payments: [] },
    items: [{ id: 'QA-I-1', description: 'Referencia técnica de prueba', category: 'PRUEBA', quantity: 1, unitValue: 100, subtotal: 100, agreement: 'SEPARADO', fulfillment: 'DISPONIBLE', photos: [] }] };
  try {
    const response = await env.BROWSER.quickAction('pdf', pdfOptions(sample));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const ok = response.ok && response.headers.get('content-type')?.includes('application/pdf') && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-';
    return { ok: Boolean(ok), bytes: ok ? bytes.length : 0, reason: ok ? '' : 'PDF_RENDER_FAILED' };
  } catch { return { ok: false, reason: 'PDF_ENGINE_UNAVAILABLE' }; }
}
