import assert from 'node:assert/strict';
import { financialPosition, deliveryPosition, planRemission, planCancellation } from '../public/js/core/order-lifecycle.js';
const order = { revision: 7, received: 2100000, refunded: 0, items: [
  { id: 'sala', quantity: 1, net: 2000000, delivered: 0, cancelled: 0 },
  { id: 'comedor', quantity: 1, net: 1500000, delivered: 0, cancelled: 0, factoryCommitted: true }
], allocations: [{ itemId: 'sala', amount: 2000000 }, { itemId: 'comedor', amount: 100000 }] };
const before = JSON.stringify(order);
assert.deepEqual(planRemission(order, [{ itemId: 'comedor', quantity: 1 }], 7).items, [{ itemId: 'comedor', quantity: 1, pendingAfter: 0 }]);
assert.equal(JSON.stringify(order), before, 'Una vista previa no confirma entrega ni mueve abonos');
assert.deepEqual(financialPosition(3500000, 2100000), { total: 3500000, paid: 2100000, due: 1400000, credit: 0 });
const cancellation = planCancellation(order, [{ itemId: 'sala', quantity: 1 }], 7);
assert.deepEqual(cancellation.financial, { total: 1500000, paid: 2100000, due: 0, credit: 600000 });
assert.equal(cancellation.requiresAllocationReview, true);
assert.equal(cancellation.requiresFactoryReview, false);
assert.equal(JSON.stringify(order), before, 'Desistir no borra un abono ni lo traslada');
assert.equal(planCancellation(order, [{ itemId: 'comedor', quantity: 1 }], 7).requiresFactoryReview, true);
for (const plan of [planRemission, planCancellation]) {
  for (const selections of [[], [{ itemId: 'ajeno', quantity: 1 }], [{ itemId: 'sala', quantity: 2 }], [{ itemId: 'sala', quantity: 0 }], [{ itemId: 'sala', quantity: -1 }], [{ itemId: 'sala', quantity: 0.5 }], [{ itemId: 'sala', quantity: 1 }, { itemId: 'sala', quantity: 1 }]]) assert.throws(() => plan(order, selections, 7));
  assert.throws(() => plan(order, [{ itemId: 'sala', quantity: 1 }], 6), /pedido cambió/);
  assert.throws(() => plan({ ...order, items: [...order.items, order.items[0]] }, [{ itemId: 'sala', quantity: 1 }], 7), /repetido/);
}
const chairs = { revision: 1, received: 0, items: [{ id: 'sillas', quantity: 4, net: 999, delivered: 0, cancelled: 0 }] };
assert.equal(planRemission(chairs, [{ itemId: 'sillas', quantity: 2 }], 1).items[0].pendingAfter, 2);
// Simulate the confirmed server ledger between requests, never change the input
// just by asking for a preview.
chairs.items[0].delivered = 2; chairs.revision++;
assert.equal(planRemission(chairs, [{ itemId: 'sillas', quantity: 1 }], 2).items[0].pendingAfter, 1);
chairs.items[0].delivered = 3; chairs.revision++;
assert.throws(() => planRemission(chairs, [{ itemId: 'sillas', quantity: 2 }], 3), /pendiente/);
assert.equal(planCancellation(chairs, [{ itemId: 'sillas', quantity: 1 }], 3).reduction, 249);
chairs.items[0].cancelled = 1; chairs.revision++;
assert.equal(deliveryPosition(chairs.items[0]).pending, 0);
assert.throws(() => planCancellation(chairs, [{ itemId: 'sillas', quantity: 1 }], 4), /pendiente/);
const discounted = { revision: 1, received: 999, items: [{ id: 'unidad', quantity: 4, net: 999, cancelled: 0 }] };
let reductions = 0;
for (let count = 0; count < 4; count++) {
  const plan = planCancellation(discounted, [{ itemId: 'unidad', quantity: 1 }], discounted.revision);
  reductions += plan.reduction; discounted.items[0].cancelled++; discounted.revision++;
}
assert.equal(reductions, 999, 'Desistimientos sucesivos conservan todos los pesos');
assert.deepEqual(financialPosition(1500000, 2100000, 600000), { total: 1500000, paid: 1500000, due: 0, credit: 0 });
assert.throws(() => financialPosition(0, 100, 101));
assert.throws(() => deliveryPosition({ quantity: 4, delivered: 3, cancelled: 2 }));
console.log('OK · planificación sin escrituras: remisiones parciales, desistimientos, saldos a favor, IDs y versión; no sustituye el backend transaccional');
