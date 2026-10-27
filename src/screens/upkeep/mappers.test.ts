import { describe, expect, it } from 'vitest';
import { MSG } from '../forms/mappers';
import { confirmFromDraft, PAY_MSG, paymentFromDraft } from './mappers';

const base = { id: 'i', cardId: 'nu', dueMonth: '2026-11', estimatedAtConfirm: 2000 };

describe('invoice confirmation', () => {
  it('stores the real amount with the estimate that was shown', () => {
    expect(confirmFromDraft('2.150,40', base)).toEqual({
      ok: true,
      value: { ...base, amount: 2150.4, origin: 'confirmada', status: 'fechada' },
    });
  });
  it('requires an amount', () => {
    expect(confirmFromDraft('', base)).toEqual({ ok: false, errors: { amount: MSG.required } });
  });
});

describe('invoice payment', () => {
  it('marks a full payment as paid', () => {
    const r = paymentFromDraft({ invoiceAmount: '2000', mode: 'full', paid: '', months: '' }, base);
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ status: 'paga', paidAmount: 2000, amount: 2000 }) });
  });
  it('records a partial payment with its plan', () => {
    const r = paymentFromDraft({ invoiceAmount: '2000', mode: 'partial', paid: '500', months: '12' }, base);
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ status: 'parcial', paidAmount: 500, partialPlanMonths: 12 }) });
  });
  it('treats an empty partial payment as zero paid', () => {
    const r = paymentFromDraft({ invoiceAmount: '2000', mode: 'partial', paid: '', months: '6' }, base);
    expect(r.ok && r.value.paidAmount).toBe(0);
  });
  it('rejects a "partial" payment that covers everything and odd plan lengths', () => {
    const r = paymentFromDraft({ invoiceAmount: '2000', mode: 'partial', paid: '2000', months: '30' }, base);
    expect(r).toEqual({ ok: false, errors: { paid: PAY_MSG.coversAll, months: PAY_MSG.planMonths } });
  });
});
