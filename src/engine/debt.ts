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

/** Price (French) system: fixed payment PMT = P·i / (1 − (1+i)^−n). The last row absorbs rounding. */
export function priceSchedule(principal: number, rate: number, months: number): ScheduleRow[] {
  check(principal, rate, months);
  const pmt = rate === 0 ? principal / months : (principal * rate) / (1 - (1 + rate) ** -months);
  const rows: ScheduleRow[] = [];
  let balance = cents(principal);
  for (let k = 1; k <= months; k++) {
    const interest = cents(balance * rate);
    const amortization = k === months ? balance : cents(cents(pmt) - interest);
    const payment = cents(amortization + interest);
    balance = cents(balance - amortization);
    rows.push({ k, payment, interest, amortization, balance });
  }
  return rows;
}

/** SAC system: constant amortization P/n, interest on the remaining balance. The last row absorbs rounding. */
export function sacSchedule(principal: number, rate: number, months: number): ScheduleRow[] {
  check(principal, rate, months);
  const constant = cents(principal / months);
  const rows: ScheduleRow[] = [];
  let balance = cents(principal);
  for (let k = 1; k <= months; k++) {
    const interest = cents(balance * rate);
    const amortization = k === months ? balance : constant;
    const payment = cents(amortization + interest);
    balance = cents(balance - amortization);
    rows.push({ k, payment, interest, amortization, balance });
  }
  return rows;
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
