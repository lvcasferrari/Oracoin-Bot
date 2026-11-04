import { describe, expect, it } from 'vitest';
import { applyBridge, applyChanges } from './scenarios';
import { monthlyCost, monthlySummary } from './summary';
import { makeProfile, TODAY } from './testing';
import type { Bridge } from './types';

const loan: Bridge = { id: 'b', name: 'Banco X', kind: 'emprestimo', monthlyRate: 0.03, months: 12, effectiveFrom: TODAY, source: 'informado' };
// A large one-off outflow in December drops the balance far below any reserve.
const short = () => applyChanges(makeProfile(), [{ type: 'emergency', amount: 12000, date: '2026-12-15' }], TODAY);

describe('monthly cost', () => {
  it('leaves variable card spend out of debts + invoices', () => {
    const [nov, dec] = monthlySummary(makeProfile(), TODAY);
    expect(nov.variable).toBe(800);
    expect(monthlyCost(nov)).toBe(1200);
    expect(monthlyCost(dec)).toBe(0);
  });
});

describe('bridge credit', () => {
  it('keeps every month at or above the reserve with one draw per month at most', () => {
    const after = applyBridge(short(), loan, 1000, TODAY);
    const draws = after.entries.filter((e) => e.name === 'Crédito ponte');
    expect(draws.length).toBeGreaterThan(0);
    expect(new Set(draws.map((e) => e.date)).size).toBe(draws.length);
    expect(after.debts).toHaveLength(draws.length);
    expect(after.debts[0]).toMatchObject({ principal: draws[0].amount, monthlyRate: 0.03, months: 12, system: 'price', startMonth: '2027-01' });
    for (const r of monthlySummary(after, TODAY)) expect(r.lowBalance).toBeGreaterThanOrEqual(1000 - 0.01);
  });
  it('the bridge installments raise the monthly cost of later months', () => {
    const after = applyBridge(short(), loan, 1000, TODAY);
    const jan = monthlySummary(after, TODAY).find((r) => r.month === '2027-01')!;
    expect(monthlyCost(jan)).toBeGreaterThan(0);
  });
  it('does nothing when the balance never drops below the reserve', () => {
    const p = makeProfile();
    expect(applyBridge(p, loan, 0, TODAY)).toBe(p);
  });
  it('parcelar fatura splits the month’s invoice instead of borrowing', () => {
    const p = applyChanges(makeProfile(), [{ type: 'emergency', amount: 9500, date: '2026-11-11' }], TODAY);
    const after = applyBridge(p, { ...loan, kind: 'parcelar_fatura', months: 6 }, 0, TODAY);
    expect(after.debts).toHaveLength(0);
    expect(after.invoices.find((i) => i.dueMonth === '2026-11')).toMatchObject({ status: 'parcial', partialPlanMonths: 6 });
    const nov = monthlySummary(after, TODAY)[0];
    expect(nov.lowBalance).toBeGreaterThan(monthlySummary(p, TODAY)[0].lowBalance);
  });
});
