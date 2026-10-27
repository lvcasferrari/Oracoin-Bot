import { cents } from './dates';
import type { Debt } from './types';

export interface ScheduleRow {
  k: number;
  payment: number;
  interest: number;
  amortization: number;
  /** Outstanding balance after this payment. */
  balance: number;
}

function check(principal: number, rate: number, months: number): void {
  if (!Number.isFinite(principal) || principal < 0) throw new RangeError('principal must be zero or positive');
  if (!Number.isFinite(rate) || rate < 0) throw new RangeError('rate must be zero or positive');
  if (!Number.isInteger(months) || months < 1) throw new RangeError('months must be a positive integer');
}

/**
 * Rounds an exact schedule to cents through running totals: each row is the difference of two
 * rounded running sums, so rows never go negative, totals stay exact and the final balance is 0.
 */
function roundSchedule(exact: { payment: number; amortization: number }[], principal: number): ScheduleRow[] {
  let paid = 0;
  let amortized = 0;
  let paidCents = 0;
  let amortizedCents = 0;
  return exact.map((row, i) => {
    paid += row.payment;
    amortized += row.amortization;
    const nextPaid = cents(paid);
    const nextAmortized = i === exact.length - 1 ? cents(principal) : Math.min(cents(amortized), cents(principal));
    const payment = cents(nextPaid - paidCents);
    const amortization = cents(nextAmortized - amortizedCents);
    paidCents = nextPaid;
    amortizedCents = nextAmortized;
    return { k: i + 1, payment, interest: cents(payment - amortization), amortization, balance: cents(cents(principal) - amortizedCents) };
  });
}

/** Price (French) system: fixed payment PMT = P·i / (1 − (1+i)^−n). */
export function priceSchedule(principal: number, rate: number, months: number): ScheduleRow[] {
  check(principal, rate, months);
  const pmt = rate === 0 ? principal / months : (principal * rate) / (1 - (1 + rate) ** -months);
  let balance = principal;
  const exact = Array.from({ length: months }, () => {
    const amortization = pmt - balance * rate;
    balance -= amortization;
    return { payment: pmt, amortization };
  });
  return roundSchedule(exact, principal);
}

/** SAC system: constant amortization P/n, interest on the remaining balance. */
export function sacSchedule(principal: number, rate: number, months: number): ScheduleRow[] {
  check(principal, rate, months);
  const amortization = principal / months;
  const exact = Array.from({ length: months }, (_, k) => ({ payment: amortization + (principal - amortization * k) * rate, amortization }));
  return roundSchedule(exact, principal);
}

export const debtSchedule = (debt: Debt): ScheduleRow[] =>
  (debt.system === 'price' ? priceSchedule : sacSchedule)(debt.principal, debt.monthlyRate, debt.months);

export interface DebtSummary {
  totalPaid: number;
  totalInterest: number;
  firstPayment: number;
  lastPayment: number;
}

export function debtSummary(schedule: ScheduleRow[]): DebtSummary {
  return {
    totalPaid: cents(schedule.reduce((s, r) => s + r.payment, 0)),
    totalInterest: cents(schedule.reduce((s, r) => s + r.interest, 0)),
    firstPayment: schedule[0]?.payment ?? 0,
    lastPayment: schedule.at(-1)?.payment ?? 0,
  };
}

/** Payment number `k` (1-based) of a debt. */
export function debtPayment(debt: Debt, k: number): number {
  const row = debtSchedule(debt)[k - 1];
  if (!row) throw new RangeError(`Debt "${debt.name}" has no payment ${k}`);
  return row.payment;
}
