// Read-only calculations for the order lifecycle. These functions do not save,
// authorize, issue documents, move money, or confirm a physical delivery.
function whole(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name}: valor inválido.`);
  return value;
}
function exactSum(values, name) {
  return whole(values.reduce((sum, value) => sum + value, 0), name);
}
export function financialPosition(total, received, refunded = 0) {
  whole(total, 'Total'); whole(received, 'Abonos'); whole(refunded, 'Devoluciones');
  if (refunded > received) throw new Error('La devolución supera los abonos registrados.');
  const paid = received - refunded;
  return { total, paid, due: Math.max(0, total - paid), credit: Math.max(0, paid - total) };
}
export function deliveryPosition(item) {
  const quantity = whole(item.quantity, 'Cantidad');
  const delivered = whole(item.delivered ?? 0, 'Entregado');
  const cancelled = whole(item.cancelled ?? 0, 'Desistido');
  if (!quantity || delivered + cancelled > quantity) throw new Error('Las cantidades del mueble no concilian.');
  return { quantity, delivered, cancelled, pending: quantity - delivered - cancelled };
}
function snapshot(order, revision) {
  whole(order.revision, 'Versión');
  if (revision !== order.revision) throw new Error('El pedido cambió. Actualiza antes de continuar.');
  if (!Array.isArray(order.items) || !order.items.length) throw new Error('Faltan los muebles del pedido.');
  const ids = new Set();
  for (const item of order.items) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('Identificador de mueble inválido o repetido.');
    ids.add(item.id); deliveryPosition(item); whole(item.net, 'Valor neto del mueble');
  }
}
function selectedItems(order, selections) {
  if (!Array.isArray(selections) || !selections.length) throw new Error('Selecciona al menos un mueble y su cantidad.');
  const seen = new Set();
  return selections.map(selection => {
    const item = order.items.find(item => item.id === selection.itemId);
    if (!item || seen.has(item.id)) throw new Error('El mueble no pertenece al pedido o está repetido.');
    seen.add(item.id);
    const quantity = whole(selection.quantity, 'Cantidad seleccionada');
    if (!quantity || quantity > deliveryPosition(item).pending) throw new Error('La cantidad supera lo pendiente de este mueble.');
    return { item, quantity };
  });
}
export function planRemission(order, selections, expectedRevision) {
  snapshot(order, expectedRevision);
  return { revision: order.revision, items: selectedItems(order, selections).map(({ item, quantity }) => ({
    itemId: item.id, quantity, pendingAfter: deliveryPosition(item).pending - quantity
  })) };
}
// Freeze the original line's net price. Partial cancellations use a cumulative
// whole-peso allocation; the final unit carries the remainder. Never recalculate
// an issued order's general discount over the remaining lines.
function cancelledValue(item, quantity = item.cancelled ?? 0) {
  return Number(BigInt(item.net) * BigInt(quantity) / BigInt(item.quantity));
}
export function planCancellation(order, selections, expectedRevision) {
  snapshot(order, expectedRevision);
  const selected = selectedItems(order, selections);
  const before = exactSum(order.items.map(item => item.net - cancelledValue(item)), 'Total vigente');
  const reductions = selected.map(({ item, quantity }) => ({
    itemId: item.id, quantity,
    reduction: cancelledValue(item, (item.cancelled ?? 0) + quantity) - cancelledValue(item),
    requiresFactoryReview: Boolean(item.factoryCommitted),
    requiresAllocationReview: Boolean((order.allocations || []).some(part => part.itemId === item.id && part.amount > 0))
  }));
  const reduction = exactSum(reductions.map(item => item.reduction), 'Ajuste');
  return { revision: order.revision, before, reduction, items: reductions,
    financial: financialPosition(before - reduction, order.received, order.refunded ?? 0),
    requiresFactoryReview: reductions.some(item => item.requiresFactoryReview),
    requiresAllocationReview: reductions.some(item => item.requiresAllocationReview)
  };
}
