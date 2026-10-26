import { addMonths, cents, monthOf } from './dates';
import { closingDate, dueDate } from './cycle';
import { projectedInvoice } from './events';
import { param } from './params';
import type { Card, Invoice, Profile } from './types';

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
  const closingDayCountsAsClosed = param(profile.parameters, 'purchase_on_closing_day_next_invoice', today) >= 0.5;
  const result: InvoiceToConfirm[] = [];
  for (const card of profile.cards) {
    for (const dueMonth of [monthOf(today), addMonths(monthOf(today), 1)]) {
      const closing = closingDate(card, dueMonth);
      const due = dueDate(card, dueMonth);
      const closed = closingDayCountsAsClosed ? closing <= today : closing < today;
      if (!closed || today > due) continue;
      const row = profile.invoices.find((i) => i.cardId === card.id && i.dueMonth === dueMonth);
      if (row?.origin === 'confirmada') continue;
      result.push({ card, dueMonth, dueDate: due, estimate: row?.amount ?? projectedInvoice(profile, card, dueMonth, today) });
    }
  }
  return result.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
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
