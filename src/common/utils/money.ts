/** Money helpers — always integer tiyns (1 tenge = 100 tiyns). Never use float. */
export function tengeToTiyns(tenge: number): number {
  return Math.round(tenge * 100);
}

export function tiynsToTengeDisplay(tiyns: number): number {
  return Math.trunc(tiyns) / 100;
}

export function applyPercentDiscount(amountTiyns: number, percent: number): number {
  const p = Math.max(0, Math.min(100, Math.trunc(percent)));
  return Math.trunc((amountTiyns * (100 - p)) / 100);
}

export function applyFixedDiscount(amountTiyns: number, discountTiyns: number): number {
  return Math.max(0, Math.trunc(amountTiyns) - Math.trunc(discountTiyns));
}
