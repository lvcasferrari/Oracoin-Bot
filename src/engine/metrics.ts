import { cents } from './dates';
import { monthEvents } from './events';
import type { Category, Profile } from './types';

const ESSENTIAL: (Category | undefined)[] = ['moradia', 'alimentacao', 'transporte', 'dividas', undefined];

/** Essential outflows of a month: housing, food, transport, debts and uncategorised entries, plus invoices and debts. */
export function essentialOutflows(profile: Profile, month: string, today: string): number {
  return cents(
    monthEvents(profile, month, today)
      .filter((e) => e.amount < 0)
      .filter((e) => e.source !== 'entry' || ESSENTIAL.includes(profile.entries.find((x) => x.id === e.refId)?.category))
      .reduce((s, e) => s - e.amount, 0),
  );
}

/** Expected income of `month`: the sum of its inflows. */
export function netIncome(profile: Profile, month: string, today: string): number {
  return cents(monthEvents(profile, month, today).reduce((s, e) => (e.amount > 0 ? s + e.amount : s), 0));
}

/**
 * Income the verdict thresholds compare against: the largest net income of this and the next two
 * months (a salary may start next month), else this month's essential outflows, else 0.
 */
export function referenceIncome(profile: Profile, today: string): number {
  const month = today.slice(0, 7);
  const months = [0, 1, 2].map((k) => {
    const [y, m] = month.split('-').map(Number);
    const total = y * 12 + (m - 1) + k;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
  const income = Math.max(...months.map((m) => netIncome(profile, m, today)));
  return income > 0 ? income : essentialOutflows(profile, month, today);
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
