import assert from 'node:assert/strict';
import {billingAlert,billingProgress,daysBetween} from '../public/js/core/billing-tracker.js';

assert.equal(billingProgress(6800000,20000000),34);
assert.equal(billingProgress(25000000,20000000),100,'A minimum target must not render above 100%');
assert.equal(daysBetween('2026-11-19','2026-11-27'),8);
assert.equal(billingAlert({daysSince:8,weeklyCount:0,weeklyTarget:2,weekday:5,warningDays:5,urgentDays:8}).level,'urgent');
assert.equal(billingAlert({daysSince:5,weeklyCount:2,weeklyTarget:2,weekday:5,warningDays:5,urgentDays:8}).level,'warning');
assert.equal(billingAlert({daysSince:2,weeklyCount:0,weeklyTarget:2,weekday:4,warningDays:5,urgentDays:8}).level,'warning');
assert.equal(billingAlert({daysSince:2,weeklyCount:2,weeklyTarget:2,weekday:4,warningDays:5,urgentDays:8}).level,'ok');
assert.equal(billingAlert({daysSince:null}).level,'urgent');
console.log('Billing UI: minimum target progress, calendar days and 5/8-day reminders passed.');
