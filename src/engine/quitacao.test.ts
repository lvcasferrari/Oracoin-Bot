import { describe, expect, it } from 'vitest';
import { priceSchedule } from './debt';
import { buildEvents } from './events';
import { annualToMonthly } from './params';
import { avoidedInstallments, classifyDebt, effectiveLoanRate, irr, payoffReturn } from './quitacao';
import { applyChanges, scenarioRows } from './scenarios';
import { makeProfile, TODAY } from './testing';
import type { Debt } from './types';

const loan: Debt = { id: 'l', name: 'Empréstimo', kind: 'emprestimo', principal: 10000, monthlyRate: 0.02, months: 12, system: 'price', startMonth: '2026-11', dueDay: 20 };

describe('irr and effective loan rate', () => {
  it('solves a simple case and refuses flows without a sign change', () => {
    expect(irr([-1000, 1100])).toBeCloseTo(0.1, 8);
    expect(irr([100, 100])).toBeNull();
  });
  it('recovers the contract rate from the installments, and a grace period lowers it', () => {
    const pmt = priceSchedule(10000, 0.02, 12)[0].payment;
    const plain = effectiveLoanRate(10000, pmt, 12);
    expect(plain.monthly).toBeCloseTo(0.02, 4);
    expect(plain.annual).toBeCloseTo(1.02 ** 12 - 1, 3);
    expect(effectiveLoanRate(10000, pmt, 12, 2).monthly).toBeLessThan(0.02);
  });
  it('charges more when fees cut the net amount received', () => {
    const pmt = priceSchedule(10000, 0.02, 12)[0].payment;
    expect(effectiveLoanRate(9500, pmt, 12).monthly).toBeGreaterThan(0.02);
  });
});

describe('payoff return', () => {
  it('skips paid installments and this month’s one once its due day passed', () => {
    expect(avoidedInstallments(loan, '2026-11', '2026-11-01')).toHaveLength(12);
    expect(avoidedInstallments(loan, '2026-11', '2026-11-25')).toHaveLength(11);
    expect(avoidedInstallments(loan, '2027-02', TODAY)).toHaveLength(9);
  });
  it('without a discount, paying the schedule balance yields the contract rate', () => {
    const r = payoffReturn(loan, {}, '2026-11', TODAY);
    expect(r.monthlyReturn).toBeCloseTo(0.02, 6);
    expect(r.payoffAmount).toBeCloseTo(10000, 0);
  });
  it('an annual discount is the return itself and prices the payoff lower', () => {
    const r = payoffReturn(loan, { discountAnnual: 0.055 }, '2026-11', TODAY);
    expect(r.monthlyReturn).toBe(annualToMonthly(0.055));
    expect(r.payoffAmount).toBeGreaterThan(10000);
  });
  it('a quoted amount below the balance yields more than the contract rate', () => {
    expect(payoffReturn(loan, { amount: 9000 }, '2026-11', TODAY).monthlyReturn).toBeGreaterThan(0.02);
  });
});

describe('reading (neutral labels)', () => {
  const base = { cashYield: 0.009, slack: 0, payoffAmount: 5000 };
  it('compares to the informed credit, the cash yield and the slack', () => {
    expect(classifyDebt(0.06, { ...base, bridgeRate: 0.05 })).toBe('custa_mais_que_credito');
    expect(classifyDebt(0.004, base)).toBe('deixar_correr');
    expect(classifyDebt(0.0186, { ...base, slack: 6000 })).toBe('alivio');
    expect(classifyDebt(0.0186, base)).toBe('alivio_sem_caixa');
    expect(classifyDebt(null, base)).toBeNull();
  });
  it('without an informed bridge never says it costs more than credit', () => {
    expect(classifyDebt(0.5, { ...base, slack: 1e9 })).toBe('alivio');
  });
});

describe('payoff as a scenario change', () => {
  it('stops the installments from the payoff month and records a one-off outflow', () => {
    const before = makeProfile({ debts: [loan] });
    const after = applyChanges(before, [{ type: 'payoff', debtId: 'l', month: '2027-01', amount: 7800 }], TODAY);
    const debtMonths = buildEvents(after, TODAY).filter((e) => e.source === 'debt').map((e) => e.date.slice(0, 7));
    expect(debtMonths).toEqual(['2026-11', '2026-12']);
    expect(after.entries.find((e) => e.name === 'Quitação: Empréstimo')).toMatchObject({ amount: 7800, recurrence: 'once', date: '2027-01-01' });
    const rows = scenarioRows(before, after);
    expect(rows.debts[0].paidOffMonth).toBe('2027-01');
    expect(rows.entries).toHaveLength(1);
  });
});
