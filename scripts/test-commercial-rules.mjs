import assert from 'node:assert/strict';
import {
  COMMERCIAL_RULES,
  manufacturingWindowLabel,
  minimumOrderDeposit,
  remainingAfterMinimumDeposit
} from '../public/js/core/commercial-rules.js';

assert.equal(COMMERCIAL_RULES.minimumOrderDepositPercent, 30, 'El abono mínimo debe permanecer en 30%');
assert.equal(COMMERCIAL_RULES.manufacturingDaysMin, 25, 'El mínimo de fabricación debe permanecer en 25 días');
assert.equal(COMMERCIAL_RULES.manufacturingDaysMax, 30, 'El máximo de fabricación debe permanecer en 30 días');
assert.equal(minimumOrderDeposit(1_000_000), 300_000);
assert.equal(remainingAfterMinimumDeposit(1_000_000), 700_000);
assert.equal(minimumOrderDeposit(0), 0);
assert.equal(manufacturingWindowLabel(), '25 a 30 días');

console.log('OK · reglas comerciales Maderarte protegidas');
