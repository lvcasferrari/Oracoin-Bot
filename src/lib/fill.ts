import { addMonths } from '../engine';

/** "Mesmo valor por N meses": sets `amount` on `n` consecutive months starting at `firstMonth`. */
export function fillSameAmount(values: Record<string, string>, firstMonth: string, n: number, amount: string): Record<string, string> {
  if (!Number.isInteger(n) || n < 1 || n > 120) throw new RangeError('n must be between 1 and 120');
  const next = { ...values };
  for (let k = 0; k < n; k++) next[addMonths(firstMonth, k)] = amount;
  return next;
}
