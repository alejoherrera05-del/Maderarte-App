export const COMMERCIAL_RULES = Object.freeze({
  manufacturingDaysMin: 25,
  manufacturingDaysMax: 30
});

// Availability belongs to each furniture line, independently of payments.
export const ITEM_FULFILLMENTS = Object.freeze([
  { code: 'DISPONIBLE', label: 'Disponible para entrega inmediata', help: 'Disponible para coordinar la entrega. Aún no se registra como entregado.' },
  { code: 'PARA_SOLICITAR', label: 'Solicitar a fábrica', help: 'Fabricación estimada de 25 a 30 días desde la confirmación de la solicitud.' },
  { code: 'POR_DEFINIR', label: 'Por definir con el cliente', help: 'La disponibilidad y la entrega de este mueble quedan por acordar.' }
].map(Object.freeze));

// Agreements describe this sale, never an executed delivery or factory request.
export const ITEM_AGREEMENTS = Object.freeze([
  { code: 'ENTREGA_HOY', label: 'Se entrega hoy', help: 'Mueble disponible. La entrega realizada se registrará en su remisión.' },
  { code: 'SEPARADO', label: 'Queda separado', help: 'El cliente continúa pagando lo acordado. No se solicita a fábrica automáticamente.' },
  { code: 'ENTREGA_POSTERIOR', label: 'Entrega después', help: 'Anota la fecha u otros acuerdos en observaciones, si ya los conocen.' }
].map(Object.freeze));

// Largest remainder in whole COP: exact totals, including a one-peso discount.
// This is an explicit price distribution, never an automatic payment allocation.
export function distributeDiscount(items, discount) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (!items.every(item => Number.isSafeInteger(item.subtotal) && item.subtotal >= 0)
    || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(discount)
    || discount < 0 || discount > subtotal) return [];
  if (!subtotal) return items.map(item => ({ ...item, discount: 0, net: 0 }));
  const denominator = BigInt(subtotal);
  const parts = items.map((item, index) => {
    const numerator = BigInt(item.subtotal) * BigInt(discount);
    return { ...item, index, discount: Number(numerator / denominator), remainder: numerator % denominator };
  });
  let left = discount - parts.reduce((sum, part) => sum + part.discount, 0);
  const ranked = [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of ranked) if (left-- > 0) part.discount++;
  return parts.map(({ index, remainder, ...part }) => ({ ...part, net: part.subtotal - part.discount }));
}

export const PAYMENT_METHODS = Object.freeze([
  { code: 'EFECTIVO', label: 'Efectivo' },
  { code: 'TRANSFERENCIA', label: 'Transferencia' },
  { code: 'TARJETA', label: 'Tarjeta' },
  { code: 'ADDI', label: 'Addi' }
].map(Object.freeze));

export function manufacturingWindowLabel() {
  return `${COMMERCIAL_RULES.manufacturingDaysMin} a ${COMMERCIAL_RULES.manufacturingDaysMax} días`;
}

// COP amounts are entered in whole pesos. Reject negatives/invalid strings;
// never turn a negative or malformed payment into a different positive amount.
export function paymentAmount(raw) {
  const clean = String(raw ?? '').replace(/[$\s]/g, '');
  if (!clean) return 0;
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)$/.test(clean)) return NaN;
  const number = Number(clean.replaceAll('.', ''));
  return Number.isSafeInteger(number) ? number : NaN;
}

export function summarizePayments(total, entries = []) {
  const payments = [];
  let error = '';
  let errorIndex = -1;
  const fail = (message, index) => { if (!error) { error = message; errorIndex = index; } };
  entries.forEach((entry, index) => {
    const amount = paymentAmount(entry.amount);
    if (!Number.isFinite(amount)) { fail('Escribe un valor válido en pesos, sin negativos ni decimales.', index); return; }
    const hasContent = amount > 0 || Boolean(entry.method || String(entry.internalNote || '').trim());
    if (!hasContent) return;
    if (amount <= 0) { fail('Indica un valor mayor que cero para este pago o quita la fila.', index); return; }
    const method = PAYMENT_METHODS.find(item => item.code === entry.method);
    if (!method) { fail('Selecciona el medio de pago de cada valor indicado.', index); return; }
    // Public projection: internal notes never become part of the document data.
    payments.push({ method: method.code, label: method.label, amount });
  });
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const validTotal = Number.isSafeInteger(total) && total >= 0;
  if (!validTotal || !Number.isSafeInteger(paid)) fail('Revisa los valores: el importe supera el rango permitido.', 0);
  else if (paid > total) fail('Los pagos superan el total del pedido. Revisa los valores antes de continuar.', 0);
  return { payments, paid, balance: validTotal ? Math.max(0, total - paid) : 0, error, errorIndex };
}
