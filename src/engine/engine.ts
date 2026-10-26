import type { CashEvent, Card, Installment, Profile, RecurringItem } from './types';

// Round to cents so sums never drift.
export const cents = (value: number): number => Math.round(value * 100) / 100;

const pad = (n: number): string => String(n).padStart(2, '0');

export const monthOf = (date: string): string => date.slice(0, 7);

/** Date for a given month and day, clamped to the month's last day (e.g. 31 in February). */
export function dateInMonth(month: string, day: number): string {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${pad(Math.min(day, last))}`;
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const total = year * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Fatura projetada for one card and invoice month: installments + variable estimate. */
export function invoiceAmount(card: Card, installments: Installment[], month: string): number {
  const committed = installments
    .filter((i) => i.cardId === card.id && i.dueMonth === month)
    .reduce((sum, i) => sum + i.amount, 0);
  return cents(committed + card.variableEstimate);
}

/** Share of net income taken by commitments: (parcelas + faturas + dívidas) ÷ renda líquida. */
export function commitmentRatio(commitments: number, netIncome: number): number {
  if (netIncome <= 0) return Infinity;
  return commitments / netIncome;
}

/**
 * Expands the profile into dated events from `from` (inclusive) for `months` months.
 * Invoices fall due on the card's due day, not on the purchase date.
 */
export function buildEvents(profile: Profile, from: string, months: number): CashEvent[] {
  const events: CashEvent[] = [];
  const start = monthOf(from);
  const addRecurring = (item: RecurringItem, sign: 1 | -1, m: string) => {
    events.push({ date: dateInMonth(m, item.day), amount: sign * item.amount, label: item.name });
  };

  for (let i = 0; i < months; i++) {
    const m = addMonths(start, i);
    profile.incomes.forEach((item) => addRecurring(item, 1, m));
    profile.outflows.forEach((item) => addRecurring(item, -1, m));
    profile.cards.forEach((card) => {
      events.push({
        date: dateInMonth(m, card.dueDay),
        amount: -invoiceAmount(card, profile.installments, m),
        label: `Fatura ${card.bank} ${card.name}`,
      });
    });
  }

  return events
    .filter((e) => e.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface BalancePoint {
  date: string;
  balance: number;
}

/** Running balance after each event, starting from the informed balance. */
export function cashProjection(startBalance: number, events: CashEvent[]): BalancePoint[] {
  let running = startBalance;
  return events.map((e) => {
    running = cents(running + e.amount);
    return { date: e.date, balance: running };
  });
}

/** The most critical point in the projection: the lowest balance and the day it happens. */
export function criticalDay(startBalance: number, events: CashEvent[]): BalancePoint | null {
  const points = cashProjection(startBalance, events);
  if (points.length === 0) return null;
  return points.reduce((low, p) => (p.balance < low.balance ? p : low), points[0]);
}

/** Margem livre do mês: renda esperada − fixos − faturas − dívidas − meta de poupança. */
export function freeMargin(profile: Profile, month: string, savingsGoal = 0): number {
  const income = profile.incomes.reduce((s, i) => s + i.amount, 0);
  const fixed = profile.outflows.reduce((s, i) => s + i.amount, 0);
  const invoices = profile.cards.reduce((s, c) => s + invoiceAmount(c, profile.installments, month), 0);
  return cents(income - fixed - invoices - savingsGoal);
}
