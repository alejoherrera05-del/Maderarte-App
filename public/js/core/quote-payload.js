import { readCommercialValues } from './commercial-form-values.js?v=lifecycle-1';

const field = id => document.getElementById(id)?.value?.trim() || '';

export function collectQuotePayload({ branch }) {
  const values = readCommercialValues();
  const items = values.items.map(item => ({
    clientLineId: String(item.itemId),
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    unitValue: item.unitValue,
    fabric: item.fabric,
    wood: item.wood,
    specifications: item.specifications,
    photos: []
  }));
  return {
    schemaVersion: 1,
    branch: String(branch || '').trim().toUpperCase(),
    client: {
      document: field('quote-client-document'),
      name: field('quote-client-name'),
      phone: field('quote-client-phone'),
      alternatePhone: field('quote-client-alternatePhone'),
      email: field('quote-client-email'),
      address: field('quote-client-address'),
      city: field('quote-client-city')
    },
    items,
    discount: values.discount,
    notes: field('quote-notes')
  };
}
