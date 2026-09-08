// Durable admission fence for an indeterminate Sheets batch. ScriptLock alone
// cannot fence a Google request still executing after an Apps Script timeout.
// No customer data, values, tokens or notes are stored in Script Properties.
var ORDER_CREATION_FENCE_KEY_ = 'ORDER_CREATION_PENDING';
function orderFenceKey_() { return typeof osFenceKey_ === 'function' ? osFenceKey_() : ORDER_CREATION_FENCE_KEY_; }

function readOrderFence_() {
  var raw = getScriptProperties_().getProperty(orderFenceKey_());
  if (!raw) return null;
  var fence = parseJson_(raw, null);
  if (!fence || !fence.requestId || !fence.uid || !fence.fingerprint) {
    throw appError_('ORDER_RECOVERY_REQUIRED', 'Hay un guardado pendiente de revisión. No se iniciará otro pedido.', 503);
  }
  return fence;
}

function clearConfirmedOrderFence_() {
  var fence = readOrderFence_();
  if (!fence) return true;
  var rows = listRows_('Idempotencia').filter(function(row) { return row.Request_ID === fence.requestId; });
  if (rows.length !== 1) return false;
  var row = rows[0];
  var saved = parseJson_(row.Resultado_JSON, null);
  if (row.Estado !== 'CONFIRMADA' || row.Usuario !== fence.uid || row.Tipo_Operacion !== (fence.operation || 'ORDEN_CREAR')
    || !saved || saved.fingerprint !== fence.fingerprint || !saved.result
    || saved.result.requestId !== fence.requestId) return false;
  getScriptProperties_().deleteProperty(orderFenceKey_());
  return true;
}

function assertNoUnresolvedOrderFence_() {
  if (!clearConfirmedOrderFence_()) {
    // Fail closed across ALL new orders, not just retries of the same ID. Never
    // expire or clear this marker merely because time passed or no row was found.
    throw appError_('ORDER_RECOVERY_REQUIRED', 'El guardado anterior aún no está confirmado. Requiere revisión antes de crear otro pedido.', 503);
  }
}

function reserveOrderFence_(requestId, uid, fingerprint, operation) {
  assertNoUnresolvedOrderFence_();
  var serialized = JSON.stringify({ requestId: requestId, uid: uid, fingerprint: fingerprint, operation: operation || 'ORDEN_CREAR', createdAt: now_().toISOString() });
  getScriptProperties_().setProperty(orderFenceKey_(), serialized);
  if (getScriptProperties_().getProperty(orderFenceKey_()) !== serialized) {
    throw appError_('ORDER_RECOVERY_REQUIRED', 'No se pudo asegurar el guardado. Conserva el borrador.', 503);
  }
}
