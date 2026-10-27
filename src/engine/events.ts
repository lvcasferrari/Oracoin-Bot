import { addMonths, cents, dateInMonth, monthDiff, monthOf } from './dates';
import { dueDate, invoiceMonthForCharge } from './cycle';
import { debtPayment } from './debt';
import { param } from './params';
import { worstCase } from './rotativo';
import type { CashEvent, Card, Entry, Invoice, Profile } from './types';

/** Date an entry falls on in `month`, or null when it does not occur that month. */
export function entryOccurrence(entry: Entry, month: string): string | null {
  if (entry.recurrence === 'once') {
    return entry.date && monthOf(entry.date) === month ? entry.date : null;
  }
  if (month < entry.startMonth || (entry.endMonth !== undefined && month > entry.endMonth)) return null;
  if (entry.recurrence === 'yearly' && month.slice(5) !== entry.startMonth.slice(5)) return null;
  return dateInMonth(month, entry.day);
}

/** Projected invoice: installments + variable estimate + card entries + partial-payment carry-over. */
export function projectedInvoice(profile: Profile, card: Card, month: string, today: string): number {
  let total = card.variableEstimate;
  for (const i of profile.installments) {
    if (i.cardId === card.id && i.dueMonth === month) total += i.amount;
  }
  for (const e of profile.entries) {
    if (e.cardId !== card.id) continue;
    if (e.kind !== 'out') throw new Error(`Entry "${e.name}": only outflows can be charged on a card`);
    // A charge lands in the invoice of its month or up to two months later.
    for (let back = 2; back >= 0; back--) {
      const charged = entryOccurrence(e, addMonths(month, -back));
      if (charged && invoiceMonthForCharge(card, charged, profile.parameters, today) === month) total += e.amount;
    }
  }
  // The unpaid part of a partial invoice comes back on later invoices as the worst-case plan.
  for (const inv of profile.invoices) {
    if (inv.cardId !== card.id || inv.status !== 'parcial') continue;
    const k = monthDiff(inv.dueMonth, month);
    if (k < 1) continue;
    const months = inv.partialPlanMonths ?? param(profile.parameters, 'partial_plan_default_months', today);
    total += worstCase(inv.amount - (inv.paidAmount ?? 0), months, profile.parameters, today).payments[k - 1] ?? 0;
  }
  return cents(total);
}

export interface InvoiceView {
  /** Full invoice amount (stored or projected). */
  total: number;
  /** Money leaving the account on the due date (the paid part of a partial payment). */
  cashOut: number;
  estimated: boolean;
  row?: Invoice;
}

/** The invoice of `card` due in `month`: the stored row when there is one, otherwise the projection. */
export function invoiceFor(profile: Profile, card: Card, month: string, today: string): InvoiceView {
  const row = profile.invoices.find((i) => i.cardId === card.id && i.dueMonth === month);
  if (!row) {
    const total = projectedInvoice(profile, card, month, today);
    return { total, cashOut: total, estimated: true };
  }
  // A payment made on or before the balance date is already inside the informed balance.
  const alreadyInBalance = row.paidOn !== undefined && row.paidOn <= profile.balanceDate;
  const paid = row.status === 'parcial' ? row.paidAmount ?? 0 : row.amount;
  const cashOut = alreadyInBalance && (row.status === 'paga' || row.status === 'parcial') ? 0 : paid;
  return { total: row.amount, cashOut, estimated: row.origin !== 'confirmada', row };
}

/** Every cash event of `month`, with no balance-date filter. */
export function monthEvents(profile: Profile, month: string, today: string): CashEvent[] {
  const events: CashEvent[] = [];
  for (const e of profile.entries) {
    if (e.cardId) continue; // paid through the card's invoice
    const date = entryOccurrence(e, month);
    if (date) {
      events.push({ date, amount: e.kind === 'in' ? e.amount : -e.amount, label: e.name, source: 'entry', refId: e.id, estimated: false });
    }
  }
  for (const card of profile.cards) {
    const view = invoiceFor(profile, card, month, today);
    if (view.cashOut === 0) continue;
    events.push({
      date: dueDate(card, month),
      amount: -view.cashOut,
      label: `Fatura ${card.bank} ${card.name}`,
      source: 'invoice',
      refId: card.id,
      estimated: view.estimated,
    });
  }
  for (const debt of profile.debts) {
    const k = monthDiff(debt.startMonth, month) + 1;
    if (k < 1 || k > debt.months) continue;
    events.push({
      date: dateInMonth(month, debt.dueDay),
      amount: -debtPayment(debt, k),
      label: debt.name,
      source: 'debt',
      refId: debt.id,
      estimated: false,
    });
  }
  return events;
}

/**
 * Cash events after the balance date, through the projection horizon. Events on or before
 * `balanceDate` are already part of the informed balance. Same-day outflows come first, so
 * the critical day is conservative.
 */
export function buildEvents(profile: Profile, today: string): CashEvent[] {
  const months = param(profile.parameters, 'projection_months', today);
  const start = monthOf(profile.balanceDate);
  const end = addMonths(monthOf(today), months - 1);
  const events: CashEvent[] = [];
  for (let m = start; m <= end; m = addMonths(m, 1)) {
    events.push(...monthEvents(profile, m, today));
  }
  return events
    .filter((e) => e.date > profile.balanceDate)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : Math.sign(a.amount) - Math.sign(b.amount)));
}

export const profileBalance = (profile: Profile): number => cents(profile.accounts.reduce((s, a) => s + a.balance, 0));

export interface BalancePoint {
  date: string;
  balance: number;
}

/** Running balance after each event, starting from `startBalance`. */
export function cashProjection(startBalance: number, events: CashEvent[]): BalancePoint[] {
  let running = startBalance;
  return events.map((e) => {
    running = cents(running + e.amount);
    return { date: e.date, balance: running };
  });
}

/** The lowest projected balance and the day it happens. */
export function criticalDay(startBalance: number, events: CashEvent[]): BalancePoint | null {
  const points = cashProjection(startBalance, events);
  if (points.length === 0) return null;
  return points.reduce((low, p) => (p.balance < low.balance ? p : low), points[0]);
}
