// Debt payoff math (plans/plano-de-quitacao.md §3). Pure: rates come in as arguments or parameters.
import { cents, dateInMonth, monthDiff, monthOf } from './dates';
import { debtSchedule } from './debt';
import { annualToMonthly } from './params';
import type { Debt } from './types';

/** Monthly rate where the flows' present value is zero (t = 0, 1, 2…); null without a sign change. */
export function irr(flows: number[], lo = -0.5, hi = 10): number | null {
  const npv = (r: number) => flows.reduce((s, f, t) => s + f / (1 + r) ** t, 0);
  let a = lo;
  let b = hi;
  let fa = npv(a);
  const fb = npv(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return null;
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    const fm = npv(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** True cost of a loan: IRR of [−net received (after IOF/fees), 0 × grace months, installment × n]. */
export function effectiveLoanRate(netReceived: number, installment: number, months: number, graceMonths = 0) {
  const monthly = irr([-netReceived, ...Array(graceMonths).fill(0), ...Array(months).fill(installment)]);
  return { monthly, annual: monthly === null ? null : (1 + monthly) ** 12 - 1, totalPaid: cents(installment * months) };
}

/** Installments a payoff in `month` avoids (this month's one is excluded when its due day has passed). */
export function avoidedInstallments(debt: Debt, month: string, today: string): number[] {
  const schedule = debtSchedule(debt);
  let first = Math.max(1, monthDiff(debt.startMonth, month) + 1);
  if (month === monthOf(today) && dateInMonth(month, debt.dueDay) < today) first++;
  return schedule.slice(first - 1).map((r) => r.payment);
}

export interface PayoffQuote {
  /** Amount the creditor asks to settle today. */
  amount?: number;
  /** Or the annual discount rate offered for early payment. */
  discountAnnual?: number;
}

export interface PayoffReturn {
  /** Monthly return of paying off: what the avoided installments "yield" on the payoff amount. */
  monthlyReturn: number | null;
  payoffAmount: number;
  avoided: number[];
}

export function payoffReturn(debt: Debt, quote: PayoffQuote, month: string, today: string): PayoffReturn {
  const avoided = avoidedInstallments(debt, month, today);
  const presentValue = (r: number) => cents(avoided.reduce((s, p, k) => s + p / (1 + r) ** (k + 1), 0));
  if (quote.amount !== undefined) {
    return { monthlyReturn: irr([-quote.amount, ...avoided]), payoffAmount: quote.amount, avoided };
  }
  // A discount rate needs no IRR: it is the return, and it prices the payoff.
  const r = quote.discountAnnual !== undefined ? annualToMonthly(quote.discountAnnual) : debt.monthlyRate;
  return { monthlyReturn: r, payoffAmount: presentValue(r), avoided };
}

export type DebtReading = 'custa_mais_que_credito' | 'alivio' | 'alivio_sem_caixa' | 'deixar_correr';

/**
 * Neutral reading of a debt (spec §3.5): never "take a loan to pay off". `bridgeRate` is the
 * cheapest bridge the user informed, never a target ("meta") rate; without one, only the last bands apply.
 */
export function classifyDebt(r: number | null, ctx: { cashYield: number; bridgeRate?: number; slack: number; payoffAmount: number }): DebtReading | null {
  if (r === null) return null;
  if (ctx.bridgeRate !== undefined && r > ctx.bridgeRate) return 'custa_mais_que_credito';
  if (r <= ctx.cashYield) return 'deixar_correr';
  return ctx.slack >= ctx.payoffAmount ? 'alivio' : 'alivio_sem_caixa';
}
