// The two standalone forms share item editing, client lookup and A4 pagination.
// Their HTML keeps the same field IDs so behavior has a single implementation.
const isOrder = document.body.dataset.commercialDocument === 'order';

export const COMMERCIAL_DOCUMENT = Object.freeze({
  isOrder,
  permission: isOrder ? 'ordenes.read' : 'cotizaciones.read',
  title: isOrder ? 'ORDEN DE PEDIDO' : 'COTIZACIÓN',
  numberLabel: isOrder ? 'Número de pedido' : 'N.º de cotización',
  pendingNumber: isOrder ? 'Borrador' : 'Pendiente de asignar',
  itemsLabel: isOrder ? 'Mobiliario del pedido' : 'Mobiliario cotizado',
  addressLabel: isOrder ? 'Dirección de entrega / Ciudad' : 'Dirección / Ciudad',
  notesLabel: isOrder ? 'Observaciones del pedido' : 'Observaciones especiales'
});
