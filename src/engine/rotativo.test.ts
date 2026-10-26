import { describe, expect, it } from 'vitest';
import { cents } from './dates';
import { invoiceFor } from './events';
import { DEFAULT_PARAMETERS, MissingParameterError } from './params';
import { worstCase } from './rotativo';
import { makeProfile, nubank, TODAY } from './testing';
import type { Invoice, Parameter } from './types';

// Round rates so the expected numbers are easy to check by hand.
const fixture: Parameter[] = [
  ...DEFAULT_PARAMETERS,
  { key: 'rotativo_monthly_rate', value: 0.15, effectiveFrom: '2026-10-30', source: 'teste' },
  { key: 'parcelado_fatura_monthly_rate', value: 0.09, effectiveFrom: '2026-10-30', source: 'teste' },
];
const sum = (xs: number[]) => cents(xs.reduce((s, x) => s + x, 0));

describe('worst case (rotativo → parcelamento, 2x cap)', () => {
  it('is not capped for 1000 in 12x', () => {
    const r = worstCase(1000, 12, fixture, TODAY);
    // 1000 × 1.15 = 1150 financed at 9% a.m. in 12x
    expect(r.monthlyPayment).toBe(160.6);
    expect(r.totalPaid).toBeCloseTo(1927.18, 0);
    expect(r.capped).toBe(false);
  });
  it('caps 1000 in 24x at exactly 2000', () => {
    const r = worstCase(1000, 24, fixture, TODAY);
    expect(r.capped).toBe(true);
    expect(r.totalPaid).toBe(2000);
    expect(sum(r.payments)).toBe(2000);
    expect(r.totalCharges).toBe(1000);
  });
  it('follows the cap parameter', () => {
    const half = [...fixture, { key: 'encargos_cap_ratio' as const, value: 0.5, effectiveFrom: '2026-10-30', source: 'teste' }];
    expect(worstCase(1000, 24, half, TODAY).totalPaid).toBe(1500);
  });
  it('costs nothing when nothing is unpaid', () => {
    const r = worstCase(0, 12, fixture, TODAY);
    expect(r.totalPaid).toBe(0);
    expect(r.payments).toEqual([]);
  });
  it('throws when a rate is missing instead of guessing', () => {
    const noRate = fixture.filter((p) => p.key !== 'rotativo_monthly_rate');
    expect(() => worstCase(1000, 12, noRate, TODAY)).toThrow(MissingParameterError);
  });
  it('lists its assumptions with sources', () => {
    const r = worstCase(1000, 12, fixture, TODAY);
    expect(r.assumptions.map((a) => a.key)).toEqual(['rotativo_monthly_rate', 'parcelado_fatura_monthly_rate', 'encargos_cap_ratio']);
    expect(r.notes.join(' ')).toMatch(/IOF/);
  });
  it('uses a rate edit only from its effective date on', () => {
    const edited = [...fixture, { key: 'rotativo_monthly_rate' as const, value: 0.2, effectiveFrom: '2026-12-01', source: 'editado por você' }];
    const before = worstCase(1000, 12, edited, '2026-11-15').totalPaid;
    const after = worstCase(1000, 12, edited, '2026-12-01').totalPaid;
    expect(after).toBeGreaterThan(before);
  });
});

describe('partial invoices in the cash flow', () => {
  const partial: Invoice = {
    id: 'inv', cardId: 'nu', dueMonth: '2026-11', amount: 2000,
    origin: 'confirmada', status: 'parcial', paidAmount: 500, partialPlanMonths: 3,
  };
  it('spreads the worst-case payments over the next projected invoices', () => {
    const profile = makeProfile({ invoices: [partial], parameters: fixture });
    const plan = worstCase(1500, 3, fixture, TODAY);
    expect(invoiceFor(profile, nubank, '2026-12', TODAY).total).toBe(cents(800 + plan.payments[0]));
    expect(invoiceFor(profile, nubank, '2027-02', TODAY).total).toBe(cents(800 + plan.payments[2]));
    expect(invoiceFor(profile, nubank, '2027-03', TODAY).total).toBe(800);
  });
  it('does not add the plan again to an invoice the user already confirmed', () => {
    const dec: Invoice = { id: 'dec', cardId: 'nu', dueMonth: '2026-12', amount: 1500, origin: 'confirmada', status: 'fechada' };
    const profile = makeProfile({ invoices: [partial, dec], parameters: fixture });
    expect(invoiceFor(profile, nubank, '2026-12', TODAY).total).toBe(1500);
  });
});
