import { addDays, addMonths, cents, daysBetween, monthOf } from './dates';
import { closingDate, dueDate } from './cycle';
import { projectedInvoice } from './events';
import { param } from './params';
import type { Card, Invoice, Parameter, Profile } from './types';

export interface InvoiceToConfirm {
  card: Card;
  dueMonth: string;
  dueDate: string;
  /** What the app expected: the stored user estimate, or the projection. */
  estimate: number;
}

/**
 * Invoices that have closed but are not due yet and have no confirmed value. Estimates are
 * computed on demand, never stored ahead, so they cannot go stale (spec 03).
 */
export function invoicesToConfirm(profile: Profile, today: string): InvoiceToConfirm[] {
  const result: InvoiceToConfirm[] = [];
  for (const card of profile.cards) {
    for (const dueMonth of [monthOf(today), addMonths(monthOf(today), 1)]) {
      const due = dueDate(card, dueMonth);
      if (today < closedOn(card, dueMonth, profile.parameters, today) || today > due) continue;
      const row = profile.invoices.find((i) => i.cardId === card.id && i.dueMonth === dueMonth);
      if (row?.origin === 'confirmada') continue;
      result.push({ card, dueMonth, dueDate: due, estimate: row?.amount ?? projectedInvoice(profile, card, dueMonth, today) });
    }
  }
  return result.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

/** First day the invoice counts as closed: the closing day itself, or the day after (a premissa). */
export function closedOn(card: Card, dueMonth: string, params: Parameter[], today: string): string {
  const closing = closingDate(card, dueMonth);
  return param(params, 'purchase_on_closing_day_next_invoice', today) >= 0.5 ? closing : addDays(closing, 1);
}

/** Days after the due date during which "Pagou?" is still asked; after that the payment is simply assumed. */
export const PAY_ASK_DAYS = 7;

export interface UpkeepTask {
  /** 'confirm': the invoice closed, is the estimate right? 'pay': it is due, was it paid? */
  kind: 'confirm' | 'pay';
  card: Card;
  dueMonth: string;
  dueDate: string;
  /** The value a one-tap answer saves: the stored amount, or the projection. */
  amount: number;
}

/**
 * Questions the user may answer now, one tap each. None is required: an unanswered invoice keeps
 * its estimate and is assumed paid in full on its due date (see invoiceFor), marked "estimado".
 * On the due date itself only "pay" is asked, since paying also confirms the value.
 */
export function pendingUpkeep(profile: Profile, today: string): UpkeepTask[] {
  const pay: UpkeepTask[] = [];
  for (const card of profile.cards) {
    for (const dueMonth of [addMonths(monthOf(today), -1), monthOf(today)]) {
      const due = dueDate(card, dueMonth);
      if (today < due || daysBetween(due, today) > PAY_ASK_DAYS) continue;
      const row = profile.invoices.find((i) => i.cardId === card.id && i.dueMonth === dueMonth);
      if (row?.status === 'paga' || row?.status === 'parcial') continue;
      const amount = row?.amount ?? projectedInvoice(profile, card, dueMonth, today);
      if (amount > 0) pay.push({ kind: 'pay', card, dueMonth, dueDate: due, amount });
    }
  }
  const confirm: UpkeepTask[] = invoicesToConfirm(profile, today)
    .filter((t) => !pay.some((p) => p.card.id === t.card.id && p.dueMonth === t.dueMonth))
    .map((t) => ({ kind: 'confirm', card: t.card, dueMonth: t.dueMonth, dueDate: t.dueDate, amount: t.estimate }));
  return [...pay, ...confirm].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

export interface ForecastError {
  count: number;
  /** Mean absolute error in reais. */
  meanAbs: number;
  /** Mean absolute error as a share of the confirmed amount. */
  meanPct: number;
}

/** Forecast quality: estimate shown at confirmation vs. the confirmed amount (spec 09 metric). */
export function forecastError(invoices: Invoice[]): ForecastError | null {
  const rows = invoices.filter((i) => i.origin === 'confirmada' && i.estimatedAtConfirm !== undefined && i.amount > 0);
  if (rows.length === 0) return null;
  const abs = rows.map((i) => Math.abs(i.amount - (i.estimatedAtConfirm as number)));
  return {
    count: rows.length,
    meanAbs: cents(abs.reduce((s, x) => s + x, 0) / rows.length),
    meanPct: abs.reduce((s, x, k) => s + x / rows[k].amount, 0) / rows.length,
  };
}
