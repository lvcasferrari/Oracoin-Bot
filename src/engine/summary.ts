import { addMonths, cents, monthOf } from './dates';
import { buildEvents, cashProjection, monthEvents, profileBalance } from './events';
import { param } from './params';
import type { CashEvent, Profile } from './types';

export interface MonthRow {
  month: string;
  income: number;
  /** Entries paid from the account (not on a card). */
  outflows: number;
  invoices: number;
  debts: number;
  /** income − outflows − invoices − debts (margem livre). */
  margin: number;
  /** Projected balance at the end of the month. */
  endBalance: number;
  /** Lowest projected balance during the month. */
  lowBalance: number;
  /** True when any invoice in the month is not confirmed. */
  estimated: boolean;
}

/** Month-by-month view over the projection horizon, starting this month (spec 07 tab 2). */
export function monthlySummary(profile: Profile, today: string): MonthRow[] {
  const first = monthOf(today);
  const months = param(profile.parameters, 'projection_months', today);
  const events = buildEvents(profile, today);
  const points = cashProjection(profileBalance(profile), events);

  let running = profileBalance(profile);
  let index = 0;
  const rows: MonthRow[] = [];
  for (let k = 0; k < months; k++) {
    const month = addMonths(first, k);
    // Like criticalDay, the low counts balances after events; a month without events keeps the carried balance.
    let low = Infinity;
    // Advance the anchored projection through this month (and any earlier months not shown).
    while (index < events.length && monthOf(events[index].date) <= month) {
      running = points[index].balance;
      if (monthOf(events[index].date) === month) low = Math.min(low, running);
      index++;
    }
    if (low === Infinity) low = running;
    const all = monthEvents(profile, month, today);
    const sum = (source: CashEvent['source']) => cents(-all.filter((e) => e.source === source && e.amount < 0).reduce((s, e) => s + e.amount, 0));
    const income = cents(all.reduce((s, e) => (e.amount > 0 ? s + e.amount : s), 0));
    const outflows = sum('entry');
    const invoices = sum('invoice');
    const debts = sum('debt');
    rows.push({
      month,
      income,
      outflows,
      invoices,
      debts,
      margin: cents(income - outflows - invoices - debts),
      endBalance: running,
      lowBalance: cents(low),
      estimated: all.some((e) => e.source === 'invoice' && e.estimated),
    });
  }
  return rows;
}

/** The month with the lowest balance point (earliest on a tie). */
export function criticalMonth(rows: MonthRow[]): MonthRow | null {
  return rows.reduce<MonthRow | null>((worst, r) => (!worst || r.lowBalance < worst.lowBalance ? r : worst), null);
}

/** Everything that leaves the account in `month`, by date (largest first on the same day). */
export function dueCalendar(profile: Profile, month: string, today: string): CashEvent[] {
  return monthEvents(profile, month, today)
    .filter((e) => e.amount < 0)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.amount - b.amount));
}

export interface DayRow extends CashEvent {
  balance: number;
}

/** Events of one month with the running projected balance after each (the daily view). */
export function dailyView(profile: Profile, month: string, today: string): DayRow[] {
  const events = buildEvents(profile, today);
  const points = cashProjection(profileBalance(profile), events);
  return events.map((e, i) => ({ ...e, balance: points[i].balance })).filter((e) => monthOf(e.date) === month);
}
