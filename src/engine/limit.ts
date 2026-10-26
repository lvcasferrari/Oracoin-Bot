import { addMonths, cents } from './dates';
import { dueDate, invoiceMonthForCharge } from './cycle';
import { invoiceFor } from './events';
import type { Card, Profile } from './types';

export interface LimitView {
  value: number;
  /** False when the user typed the real available limit (preferred, spec 05). */
  estimated: boolean;
}

/**
 * Available limit. The user's informed value wins. Otherwise an estimate: limit − open invoice −
 * a closed invoice not yet paid − future installments not yet billed (no source confirms every
 * bank blocks the full installment purchase, so it is always labelled "estimativa").
 */
export function availableLimit(profile: Profile, card: Card, today: string): LimitView {
  if (card.availableInformed !== undefined) return { value: card.availableInformed, estimated: false };
  const open = invoiceMonthForCharge(card, today, profile.parameters, today);
  let used = invoiceFor(profile, card, open, today).total;
  const previous = addMonths(open, -1);
  const closed = invoiceFor(profile, card, previous, today);
  if (dueDate(card, previous) >= today && closed.row?.status !== 'paga') used += closed.total;
  for (const i of profile.installments) {
    if (i.cardId === card.id && i.dueMonth > open) used += i.amount;
  }
  return { value: cents(card.limit - used), estimated: true };
}
