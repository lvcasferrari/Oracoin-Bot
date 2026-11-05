// Histórico (plano-de-quitacao §5.4): past months, what was due against what was paid.
import { addMonths, cents, monthOf } from './dates';
import { monthEvents } from './events';
import type { Payment, Profile } from './types';

export interface HistoryItem {
  refType: 'invoice' | 'debt';
  refId: string;
  label: string;
  due: number;
  /** Null while not marked as paid. */
  paid: number | null;
}

export interface HistoryMonth {
  month: string;
  items: HistoryItem[];
  due: number;
  paid: number;
}

/** The last `months` months up to this one, newest first. Only invoices and debt instalments are tracked. */
export function paymentHistory(profile: Profile, payments: Payment[], today: string, months = 6): HistoryMonth[] {
  const out: HistoryMonth[] = [];
  for (let k = 0; k < months; k++) {
    const month = addMonths(monthOf(today), -k);
    const items: HistoryItem[] = monthEvents(profile, month, today)
      .filter((e) => (e.source === 'invoice' || e.source === 'debt') && e.amount < 0)
      .map((e) => {
        const refType = e.source as 'invoice' | 'debt';
        const hit = payments.filter((p) => p.refType === refType && p.refId === e.refId && p.month === month);
        return { refType, refId: e.refId, label: e.label, due: -e.amount, paid: hit.length ? cents(hit.reduce((s, p) => s + p.amount, 0)) : null };
      });
    out.push({ month, items, due: cents(items.reduce((s, i) => s + i.due, 0)), paid: cents(items.reduce((s, i) => s + (i.paid ?? 0), 0)) });
  }
  return out;
}

/** Stable id, so marking the same item twice updates it instead of adding a second payment. */
export const paymentId = (refType: Payment['refType'], refId: string, month: string) => `pay-${refType}-${refId}-${month}`;
