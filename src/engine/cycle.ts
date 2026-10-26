import { addMonths, dateInMonth, monthOf } from './dates';
import { param } from './params';
import type { Card, Parameter } from './types';

/** Day the invoice due in `dueMonth` must be paid. */
export const dueDate = (card: Card, dueMonth: string): string => dateInMonth(dueMonth, card.dueDay);

/**
 * Day the invoice due in `dueMonth` closes. When the closing day comes before the due day,
 * both fall in the same month; otherwise the invoice closes in the previous month.
 */
export function closingDate(card: Card, dueMonth: string): string {
  const closingMonth = card.closingDay < card.dueDay ? dueMonth : addMonths(dueMonth, -1);
  return dateInMonth(closingMonth, card.closingDay);
}

/** Invoice month (due month) that a charge made on `date` lands in. */
export function invoiceMonthForCharge(card: Card, date: string, params: Parameter[], today: string): string {
  const closingDayGoesNext = param(params, 'purchase_on_closing_day_next_invoice', today) >= 0.5;
  const start = monthOf(date);
  for (let i = 0; i <= 2; i++) {
    const dueMonth = addMonths(start, i);
    const closing = closingDate(card, dueMonth);
    if (closingDayGoesNext ? closing > date : closing >= date) return dueMonth;
  }
  throw new Error(`No invoice found for a charge on ${date} (card ${card.id})`);
}
