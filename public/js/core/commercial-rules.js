export const COMMERCIAL_RULES = Object.freeze({
  minimumOrderDepositPercent: 30,
  manufacturingDaysMin: 25,
  manufacturingDaysMax: 30
});

export function minimumOrderDeposit(total) {
  const value = Number(total);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * (COMMERCIAL_RULES.minimumOrderDepositPercent / 100));
}

export function remainingAfterMinimumDeposit(total) {
  const value = Number(total);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, value - minimumOrderDeposit(value));
}

export function manufacturingWindowLabel() {
  return `${COMMERCIAL_RULES.manufacturingDaysMin} a ${COMMERCIAL_RULES.manufacturingDaysMax} días`;
}
