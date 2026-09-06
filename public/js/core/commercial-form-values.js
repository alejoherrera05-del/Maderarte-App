import { ITEM_PURPOSES } from './order-agreements.js?v=item-purpose-1';
import { paymentAmount } from './commercial-rules.js?v=agreements-1';

export function readFurniture(card, index = 0) {
  const field = name => card.querySelector(`[data-field="${name}"]`)?.value?.trim() || '';
  const rawQuantity = Number(field('quantity'));
  const quantity = Number.isSafeInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : NaN;
  const unitValue = paymentAmount(field('unitValue'));
  const product = quantity * unitValue;
  const purpose = ITEM_PURPOSES.find(item => item.code === field('purpose')) || null;
  return {
    itemId: card.dataset.itemId, position: index + 1,
    description: field('description'), category: field('category'), quantity, unitValue,
    fabric: field('fabric'), wood: field('wood'), specifications: field('specifications'),
    subtotal: Number.isSafeInteger(product) && product >= 0 ? product : NaN,
    purpose
  };
}

export function readCommercialValues(root = document) {
  const items = [...root.querySelectorAll('.quote-item')].map(readFurniture);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = paymentAmount(root.querySelector('#quote-discount')?.value);
  const valid = Number.isSafeInteger(subtotal) && Number.isSafeInteger(discount) && discount <= subtotal;
  return { items, subtotal, discount, total: valid ? subtotal - discount : NaN };
}
