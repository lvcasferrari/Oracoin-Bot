import { cents } from './dates';
import { monthEvents } from './events';
import type { Profile } from './types';

/** Expected income of `month`: the sum of its inflows. */
export function netIncome(profile: Profile, month: string, today: string): number {
  return cents(monthEvents(profile, month, today).reduce((s, e) => (e.amount > 0 ? s + e.amount : s), 0));
}

/** Day of the largest monthly income (earliest day on a tie), or null without income. */
export function payday(profile: Profile): number | null {
  const incomes = profile.entries.filter((e) => e.kind === 'in' && e.recurrence === 'monthly');
  if (incomes.length === 0) return null;
  return incomes.reduce((best, e) => (e.amount > best.amount || (e.amount === best.amount && e.day < best.day) ? e : best)).day;
}

/** Margem livre do mês: income − outflows − invoices − debts (spec 05). */
export function freeMargin(profile: Profile, month: string, today: string): number {
  return cents(monthEvents(profile, month, today).reduce((s, e) => s + e.amount, 0));
}

/** Comprometimento: (invoices + debts) ÷ net income. Infinity without income. */
export function commitmentRatio(profile: Profile, month: string, today: string): number {
  const income = netIncome(profile, month, today);
  if (income <= 0) return Infinity;
  const committed = monthEvents(profile, month, today)
    .filter((e) => e.source === 'invoice' || e.source === 'debt')
    .reduce((s, e) => s - e.amount, 0);
  return committed / income;
}
