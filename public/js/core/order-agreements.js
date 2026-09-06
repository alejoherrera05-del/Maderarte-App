// One choice at the furniture itself. It describes intent, never an executed
// delivery, factory request, payment, or stock reservation.
export const ITEM_PURPOSES = Object.freeze([
  { code: 'ENTREGA_INMEDIATA', label: 'Entrega inmediata' },
  { code: 'PARA_SOLICITAR', label: 'Solicitar a fábrica' },
  { code: 'SEPARADO', label: 'Separado' }
].map(Object.freeze));

export function itemPurposeMarkup(id) {
  return `<div class="quote-field quote-item-purpose"><label for="order-item-${id}-purpose">Este mueble es para</label><select id="order-item-${id}-purpose" data-field="purpose" data-item-purpose required><option value="">Seleccionar</option>${ITEM_PURPOSES.map(item => `<option value="${item.code}">${item.label}</option>`).join('')}</select></div>`;
}

// Recover old common/individual drafts without turning a separated item into
// a factory request. Extra delivery details remain readable in observations.
export function legacyItemPurpose(agreement, fulfillment, description = 'Mueble') {
  let purpose = '';
  const notes = [];
  if (agreement === 'SEPARADO') {
    purpose = 'SEPARADO';
    if (fulfillment === 'PARA_SOLICITAR') notes.push('separado; requiere fábrica');
    if (fulfillment === 'DISPONIBLE') notes.push('separado; disponible');
  } else if (agreement === 'ENTREGA_HOY') purpose = 'ENTREGA_INMEDIATA';
  else if (agreement === 'ENTREGA_POSTERIOR') {
    if (fulfillment === 'PARA_SOLICITAR') purpose = 'PARA_SOLICITAR';
    else if (fulfillment === 'DISPONIBLE') purpose = 'ENTREGA_INMEDIATA';
    notes.push(fulfillment === 'DISPONIBLE' ? 'disponible; entrega posterior' : fulfillment === 'POR_DEFINIR' ? 'entrega posterior; disponibilidad por definir' : 'entrega posterior');
  }
  return { purpose, note: notes.length ? `${description || 'Mueble'}: ${notes.join('; ')}.` : '' };
}
