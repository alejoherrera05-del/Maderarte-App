import { readCommercialValues } from './commercial-form-values.js?v=lifecycle-1';
import { readOrderEntry } from './order-entry.js?v=lifecycle-1';
import { paymentAmount } from './commercial-rules.js?v=agreements-1';

const invalid = (message, field) => { throw Object.assign(new Error(message), { field }); };

// A private command payload, NOT the public projection used for client PDFs.
// Preserve stable row IDs, leading zeros and each payment's internal note.
export function collectOrderPayload({ root = document, branch, photos = new Map(), photoManifests = null }) {
  const values = readCommercialValues(root);
  const entry = readOrderEntry(values.total, root);
  if (!['MP', 'TP'].includes(branch)) invalid('Selecciona la sede del pedido.', 'branch');
  if (!Number.isSafeInteger(values.total) || values.total < 0) invalid('Revisa los importes del pedido.', 'discount');
  if (entry.error) invalid(entry.error, 'payments');
  // Old hidden allocations must not silently disappear in a new save contract.
  if (entry.allocate) invalid('Este borrador conserva una distribución antigua. Requiere revisión antes de guardarlo.', 'allocation');
  const client = {};
  for (const name of ['document', 'name', 'phone', 'alternatePhone', 'email', 'address', 'city']) {
    client[name] = root.getElementById(`quote-client-${name}`)?.value.trim() || '';
    if (!client[name] && name !== 'alternatePhone') invalid('Completa los datos del cliente.', `client.${name}`);
  }
  if (client.email.toUpperCase() === 'N/A') client.email = 'N/A';
  if (!values.items.length || values.items.length > 100) invalid('Incluye entre uno y cien muebles.', 'items');
  const items = values.items.map(item => {
    if (!item.agreement || !item.fulfillment) invalid('Selecciona qué se hará con este mueble.', `items.${item.itemId}.agreement`);
    if (!item.description || !Number.isSafeInteger(item.quantity) || item.quantity < 1
      || !Number.isSafeInteger(item.unitValue) || item.unitValue < 1) invalid('Revisa la descripción, cantidad y precio del mueble.', `items.${item.itemId}`);
    const references = photos.get(Number(item.itemId)) || photos.get(item.itemId) || [];
    // v1's server rejects images. Never strip them to make the request succeed.
    if (!photoManifests && (references.length || root.querySelector(`[data-item-id="${item.itemId}"] [data-photo-list] img`))) {
      invalid('El guardado de fotografías aún está en preparación. Conserva el borrador con todas sus referencias.', `items.${item.itemId}.photos`);
    }
    return { clientLineId: item.itemId, description: item.description, category: item.category,
      quantity: item.quantity, unitValue: item.unitValue, fabric: item.fabric, wood: item.wood,
      specifications: item.specifications, agreement: item.agreement.code, fulfillment: item.fulfillment.code, photos: photoManifests?.get(String(item.itemId)) || [] };
  });
  const payments = [...root.querySelectorAll('[data-payment-row]')].map(row => ({
    clientPaymentId: row.dataset.paymentRow,
    method: row.querySelector('[data-payment-method]').value,
    amount: paymentAmount(row.querySelector('[data-payment-amount]').value),
    internalNote: row.querySelector('[data-payment-note]').value.trim()
  })).filter(payment => payment.amount > 0);
  return { schemaVersion: photoManifests ? 2 : 1, branch, client, items, payments, discount: values.discount,
    notes: root.getElementById('quote-notes')?.value.trim() || '', noPayment: entry.noPayment };
}
