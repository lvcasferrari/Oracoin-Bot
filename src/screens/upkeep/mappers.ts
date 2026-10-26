// Pure: invoice confirmation and payment forms → Invoice rows. Tested in Vitest.
import type { Invoice } from '../../engine';
import { parseBRL } from '../../lib/money';
import { MSG, type Result } from '../forms/mappers';

export const PAY_MSG = {
  coversAll: 'Isso cobre a fatura toda. Escolha "Paguei tudo".',
  planMonths: 'Use de 1 a 24 parcelas.',
} as const;

interface InvoiceBase {
  id: string;
  cardId: string;
  dueMonth: string;
  estimatedAtConfirm?: number;
}

/** "Confirma o valor?": the real amount that came on the closed invoice. */
export function confirmFromDraft(amountText: string, base: InvoiceBase): Result<Invoice> {
  const amount = parseBRL(amountText);
  if (amount === null) return { ok: false, errors: { amount: amountText.trim() ? MSG.money : MSG.required } };
  return { ok: true, value: { ...base, amount, origin: 'confirmada', status: 'fechada' } };
}

export interface PaymentDraft {
  invoiceAmount: string;
  mode: 'full' | 'partial';
  paid: string;
  months: string;
}

/** "Marquei como paga": full, or partial with the rest going to the worst-case plan. */
export function paymentFromDraft(d: PaymentDraft, base: InvoiceBase): Result<Invoice> {
  const errors: Record<string, string> = {};
  const amount = parseBRL(d.invoiceAmount);
  if (amount === null || amount <= 0) errors.invoiceAmount = d.invoiceAmount.trim() ? MSG.positive : MSG.required;

  if (d.mode === 'full') {
    if (Object.keys(errors).length) return { ok: false, errors };
    return { ok: true, value: { ...base, amount: amount as number, origin: 'confirmada', status: 'paga', paidAmount: amount as number } };
  }

  const paid = d.paid.trim() === '' ? 0 : parseBRL(d.paid);
  if (paid === null) errors.paid = MSG.money;
  else if (amount !== null && paid >= amount) errors.paid = PAY_MSG.coversAll;
  const months = /^\s*\d+\s*$/.test(d.months) ? Number(d.months) : NaN;
  if (!(months >= 1 && months <= 24)) errors.months = PAY_MSG.planMonths;
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { ...base, amount: amount as number, origin: 'confirmada', status: 'parcial', paidAmount: paid as number, partialPlanMonths: months },
  };
}
