// Navigation follows recorded quantities, never payments or a WhatsApp draft.
export function unrequestedQuantity(item) {
  const totals = Object.values(item.tracking?.totals || {});
  const covered = Math.max(item.delivered || 0, item.tracking?.received || 0, ...totals, 0);
  return Math.max(0, Math.min(item.pending || 0, item.quantity - covered));
}

export function furnitureNextAction(item, order = {}) {
  if (!['CONFIRMADA', 'EN_PROCESO'].includes(order.status) || item.status === 'ANULADO' || item.cancelled > 0 || !(item.pending > 0) || item.tracking?.legacy) return null;
  if (item.fulfillment === 'DISPONIBLE' || item.tracking?.available > 0) return {kind:'remision',label:'Preparar remisión',permission:'remisiones.read'};
  if (item.fulfillment !== 'PARA_SOLICITAR') return null;
  if (item.tracking?.stage) return {kind:'tracking',label:'Actualizar producción',permission:'produccion.update'};
  return {kind:'produccion',label:'Preparar solicitud',permission:'produccion.read'};
}

