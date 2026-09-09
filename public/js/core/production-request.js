// Read-only preparation. This is not a production movement or supplier confirmation.
export function productionEligibility(order, item) {
  if (!['CONFIRMADA', 'EN_PROCESO'].includes(order?.status)) return 'Esta OP no está activa.';
  if (!item?.id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return 'Revisa los datos del mueble.';
  if (![item.delivered, item.cancelled, item.pending].every(n => Number.isSafeInteger(n) && n >= 0)
    || item.pending !== item.quantity - item.delivered - item.cancelled) return 'Las cantidades requieren revisión.';
  if (item.cancelled) return 'El mueble tiene un ajuste pendiente de revisión.';
  if (!item.pending) return 'Sin unidades pendientes.';
  if (item.fulfillment === 'DISPONIBLE') return 'Disponible en almacén.';
  if (item.fulfillment !== 'PARA_SOLICITAR') return 'Primero define la disponibilidad en la OP.';
  return '';
}

export function buildProductionRequest({ order, items, selected, supplier = '', notes = '', customerNotice = false, priorReview = false }) {
  if (!priorReview) throw new Error('Confirma que revisaste las solicitudes previas al proveedor.');
  if (!Array.isArray(selected) || !selected.length) throw new Error('Selecciona al menos un mueble.');
  const seen = new Set();
  const lines = selected.map(selection => {
    if (seen.has(selection.id)) throw new Error('Un mueble está repetido.');
    seen.add(selection.id);
    const matches = items.filter(item => item.id === selection.id);
    if (matches.length !== 1) throw new Error('El mueble no corresponde a esta OP.');
    const item = matches[0], issue = productionEligibility(order, item);
    if (issue) throw new Error(issue);
    if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > item.pending) throw new Error('Revisa la cantidad que vas a solicitar.');
    if (item.agreement === 'SEPARADO' && !customerNotice) throw new Error('Confirma que el cliente avisó para solicitar su separado.');
    return { item, quantity: selection.quantity };
  });
  const clean = value => String(value || '').trim();
  const message = [supplier.trim() ? `Hola, ${supplier.trim()}.` : 'Hola.', 'Solicitud de fabricación · Maderarte', `OP: ${order.number}`, ''];
  lines.forEach(({ item, quantity }, index) => {
    message.push(`${index + 1}. ${clean(item.description)}`, `Cantidad: ${quantity} ${clean(item.unit) || 'UN'}`);
    for (const [label, key] of [['Referencia', 'reference'], ['Tela / tapizado', 'fabricColor'], ['Madera / acabado', 'woodColor'], ['Medidas', 'measures'], ['Especificaciones', 'specifications']]) {
      if (clean(item[key])) message.push(`${label}: ${clean(item[key])}`);
    }
    message.push('');
  });
  if (clean(notes)) message.push('Indicaciones para fabricación:', clean(notes), '');
  message.push('Por favor confirma la recepción del pedido y la fecha estimada en que estará listo.', 'Destino: bodega de Maderarte en Popayán. Coordinamos el transporte cuando esté listo.');
  return message.join('\n');
}

export function supplierWhatsAppUrl(phone, message) {
  let digits = String(phone || '').replace(/[\s()+-]/g, '');
  if (digits && !/^\d{10,15}$/.test(digits)) throw new Error('Escribe el WhatsApp con código de país, por ejemplo +57 seguido del número.');
  if (digits.length === 10) digits = '57' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
