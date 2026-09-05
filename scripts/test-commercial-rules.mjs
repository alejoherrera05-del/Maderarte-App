import assert from 'node:assert/strict';
import { COMMERCIAL_RULES, PAYMENT_METHODS, ITEM_FULFILLMENTS, summarizePayments, paymentAmount, manufacturingWindowLabel } from '../public/js/core/commercial-rules.js';

assert.equal(COMMERCIAL_RULES.minimumOrderDepositPercent, undefined);
assert.equal(manufacturingWindowLabel(), '25 a 30 días');
assert.deepEqual(ITEM_FULFILLMENTS.map(mode => mode.code), ['DISPONIBLE', 'PARA_SOLICITAR', 'POR_DEFINIR']);
assert.deepEqual(PAYMENT_METHODS.map(method => method.code), ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'ADDI']);
for (const amount of [1, 50000, 100000, 1000000]) {
  const summary = summarizePayments(1000000, [{ amount, method: 'EFECTIVO' }]);
  assert.equal(summary.error, '');
  assert.equal(summary.paid, amount, 'El abono puede ser cualquier importe positivo acordado');
  assert.equal(summary.balance, 1000000 - amount);
}
assert.equal(paymentAmount('$ 50.000'), 50000);
assert.equal(paymentAmount('001000'), 1000);
for (const raw of ['-50000', '50,25', '10.50', '1e6', 'Infinity', 'abc', '9007199254740992']) assert.ok(Number.isNaN(paymentAmount(raw)), raw);
const empty = summarizePayments(1000000, [{ method: '', amount: '' }]);
assert.equal(empty.paid, 0);
assert.equal(empty.balance, 1000000);
assert.equal(empty.error, '');
const mixed = summarizePayments(1000000, [
  { method: 'TRANSFERENCIA', amount: '50000', internalNote: 'INTERNO-PRIVADO-A' },
  { method: 'EFECTIVO', amount: '100000' },
  { method: 'TARJETA', amount: '250000' },
  { method: 'ADDI', amount: '600000', internalNote: 'INTERNO-PRIVADO-B' }
]);
assert.equal(mixed.error, '');
assert.equal(mixed.paid, 1000000);
assert.equal(mixed.balance, 0);
assert.equal(mixed.payments.length, 4);
assert.doesNotMatch(JSON.stringify(mixed), /INTERNO|internalNote/);
for (const entries of [
  [{ method: '', amount: '50000' }],
  [{ method: 'OTRO_INVALIDO', amount: '50000' }],
  [{ method: 'EFECTIVO', amount: '-50000' }],
  [{ method: 'EFECTIVO', amount: '0' }],
  [{ method: '', amount: '', internalNote: 'Pago sin completar' }],
  [{ method: 'ADDI', amount: '1000001' }],
  [{ method: 'EFECTIVO', amount: '700000' }, { method: 'TARJETA', amount: '400000' }]
]) assert.ok(summarizePayments(1000000, entries).error, JSON.stringify(entries));
console.log('OK · separados de importe libre, pagos combinados, saldo, importes inválidos y notas internas excluidas');
