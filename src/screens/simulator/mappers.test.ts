import { describe, expect, it } from 'vitest';
import { changeFromDraft, defaultDraft, describeRows, SIM_TYPES } from './mappers';

const ctx = { dueMonthFor: () => '2026-12' };
const today = '2026-11-20';

describe('simulator form mappers', () => {
  it('offers the eight scenario types of spec 04', () => {
    expect(SIM_TYPES).toHaveLength(8);
  });
  it('maps a purchase, with optional interest', () => {
    expect(changeFromDraft('purchase', { cardId: 'nu', total: '3.000', installments: '10', ratePct: '' }, ctx)).toEqual({
      ok: true, value: { type: 'purchase', cardId: 'nu', total: 3000, installments: 10, interestMonthly: undefined },
    });
    const withRate = changeFromDraft('purchase', { cardId: 'nu', total: '3000', installments: '10', ratePct: '1,99' }, ctx);
    expect(withRate.ok && withRate.value).toMatchObject({ interestMonthly: 0.0199 });
  });
  it('maps a partial payment to the card next invoice', () => {
    const r = changeFromDraft('payPartial', { cardId: 'nu', payNow: '500', months: '12' }, ctx);
    expect(r).toEqual({ ok: true, value: { type: 'payPartial', cardId: 'nu', dueMonth: '2026-12', payNow: 500, months: 12 } });
  });
  it('maps a mortgage with its income stress test', () => {
    const d = { ...defaultDraft('mortgage', { today, partialMonths: 12 }), price: '400.000', downPayment: '80.000', ratePct: '0,9' };
    const r = changeFromDraft('mortgage', d, ctx);
    expect(r.ok && r.value).toMatchObject({ type: 'debt', downPayment: 80000, incomeStressPct: 0.2, debt: { kind: 'hipoteca', principal: 400000, monthlyRate: 0.009, months: 360, system: 'sac', startMonth: '2026-12' } });
  });
  it('maps an income drop as a negative percentage', () => {
    const r = changeFromDraft('incomeDrop', defaultDraft('incomeDrop', { today, partialMonths: 12 }), ctx);
    expect(r).toEqual({ ok: true, value: { type: 'incomeChange', deltaPct: -0.3, months: 3, startMonth: '2026-12' } });
  });
  it('defaults the emergency date to today', () => {
    const r = changeFromDraft('emergency', { ...defaultDraft('emergency', { today, partialMonths: 12 }), amount: '2.500' }, ctx);
    expect(r).toEqual({ ok: true, value: { type: 'emergency', amount: 2500, date: '2026-11-20' } });
  });
  it('describes exactly the rows that will be written', () => {
    const lines = describeRows(
      {
        entries: [{ id: 'e', kind: 'out', name: 'Streaming', amount: 39.9, day: 10, recurrence: 'monthly', startMonth: '2026-12' }],
        installments: [
          { id: 'a', cardId: 'nu', dueMonth: '2027-01', amount: 500 },
          { id: 'b', cardId: 'nu', dueMonth: '2026-12', amount: 500 },
        ],
        debts: [],
        invoices: [{ id: 'i', cardId: 'nu', dueMonth: '2026-12', amount: 2000, origin: 'confirmada', status: 'parcial', paidAmount: 500, partialPlanMonths: 6 }],
      },
      [{ id: 'nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 1, variableEstimate: 0 }],
    );
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Saída "Streaming": R\$\s?39,90 todo mês, dia 10, de dez\/26 em diante$/);
    expect(lines[1]).toMatch(/^2 parcelas no Nubank, de dez\/26 a jan\/27: R\$\s?1\.000,00 no total$/);
    expect(lines[2]).toMatch(/pagamento parcial de R\$\s?500,00, restante em 6 parcelas/);
  });
  it('rejects missing or impossible values with calm messages', () => {
    const r = changeFromDraft('financing', { ...defaultDraft('financing', { today, partialMonths: 12 }), price: '10.000', downPayment: '20.000', ratePct: '' }, ctx);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['downPayment', 'ratePct']);
    const s = changeFromDraft('subscription', { name: '', amount: '', day: '40', cardId: '' }, ctx);
    expect(!s.ok && Object.keys(s.errors).sort()).toEqual(['amount', 'day']);
  });
});
