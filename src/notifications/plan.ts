// Pure: which invoice reminders to schedule (tested in Vitest). The native side lives in Reminders.tsx.
import { addMonths, closedOn, dueDate, monthOf, projectedInvoice, type Profile } from '../engine';
import { formatBRL } from '../lib/money';

/** Reminders fire at this local hour. */
export const REMINDER_HOUR = 10;

export interface Reminder {
  /** One per card, invoice and kind, so rescheduling replaces instead of duplicating. */
  id: string;
  /** Local day it fires on (YYYY-MM-DD). */
  date: string;
  kind: 'confirm' | 'pay';
  cardId: string;
  dueMonth: string;
  title: string;
  body: string;
}

/**
 * At most two per invoice: the day it closes ("veio isso?") and the due date ("pagou?").
 * Only future days (today is covered by Pendências on Hoje), and only questions still open.
 * Three invoice months ahead keeps well under the iOS limit of 64 pending notifications.
 */
export function planReminders(profile: Profile, today: string): Reminder[] {
  const out: Reminder[] = [];
  for (const card of profile.cards) {
    for (let k = 0; k < 3; k++) {
      const dueMonth = addMonths(monthOf(today), k);
      const row = profile.invoices.find((i) => i.cardId === card.id && i.dueMonth === dueMonth);
      const amount = row?.amount ?? projectedInvoice(profile, card, dueMonth, today);
      if (amount <= 0) continue;
      const value = formatBRL(amount);
      const closed = closedOn(card, dueMonth, profile.parameters, today);
      if (closed > today && row?.origin !== 'confirmada') {
        out.push({
          id: `confirm-${card.id}-${dueMonth}`, date: closed, kind: 'confirm', cardId: card.id, dueMonth,
          title: `Fatura ${card.bank} fechou`,
          body: `Veio cerca de ${value}? Se sim, é só confirmar.`,
        });
      }
      const due = dueDate(card, dueMonth);
      if (due > today && row?.status !== 'paga' && row?.status !== 'parcial') {
        out.push({
          id: `pay-${card.id}-${dueMonth}`, date: due, kind: 'pay', cardId: card.id, dueMonth,
          title: `Fatura ${card.bank} vence hoje`,
          body: `${value}. Já pagou?`,
        });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
