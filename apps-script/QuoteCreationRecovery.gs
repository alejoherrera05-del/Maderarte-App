// Durable fence for an indeterminate quote batch. It stores only the request
// identity, owner and fingerprint; never customer data or commercial values.
var QUOTE_CREATION_FENCE_KEY_ = 'QUOTE_CREATION_PENDING';
function quoteFenceKey_() {
  return typeof osQuoteFenceKey_ === 'function' ? osQuoteFenceKey_() : QUOTE_CREATION_FENCE_KEY_;
}
function readQuoteFence_() {
  var raw = getScriptProperties_().getProperty(quoteFenceKey_());
  if (!raw) return null;
  var fence = parseJson_(raw, null);
  if (!fence || !fence.requestId || !fence.uid || !fence.fingerprint) {
    throw appError_('QUOTE_RECOVERY_REQUIRED', 'Hay una emisión pendiente de revisión. No se iniciará otra cotización.', 503);
  }
  return fence;
}
function clearConfirmedQuoteFence_() {
  var fence = readQuoteFence_();
  if (!fence) return true;
  var rows = listRows_('Idempotencia').filter(function(row) { return row.Request_ID === fence.requestId; });
  if (rows.length !== 1) return false;
  var row = rows[0], saved = parseJson_(row.Resultado_JSON, null);
  if (row.Estado !== 'CONFIRMADA' || row.Usuario !== fence.uid || row.Tipo_Operacion !== 'COTIZACION_CREAR'
    || !saved || saved.fingerprint !== fence.fingerprint || !saved.result || saved.result.requestId !== fence.requestId) return false;
  getScriptProperties_().deleteProperty(quoteFenceKey_());
  return true;
}
function assertNoUnresolvedQuoteFence_() {
  if (!clearConfirmedQuoteFence_()) throw appError_('QUOTE_RECOVERY_REQUIRED', 'La cotización anterior aún no está confirmada. Requiere revisión antes de emitir otra.', 503);
}
function reserveQuoteFence_(requestId, uid, fingerprint) {
  assertNoUnresolvedQuoteFence_();
  var serialized = JSON.stringify({ requestId: requestId, uid: uid, fingerprint: fingerprint, createdAt: now_().toISOString() });
  getScriptProperties_().setProperty(quoteFenceKey_(), serialized);
  if (getScriptProperties_().getProperty(quoteFenceKey_()) !== serialized) throw appError_('QUOTE_RECOVERY_REQUIRED', 'No se pudo asegurar la recuperación de la cotización. Conserva el borrador.', 503);
}
