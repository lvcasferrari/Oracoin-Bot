import { describe, expect, it } from 'vitest';
import { cents } from './dates';
import { invoiceFor } from './events';
import { netIncome } from './metrics';
import { worstCase } from './rotativo';
import { applyChanges, evaluate, scenarioRows } from './scenarios';
import { makeProfile, nubank, TODAY } from './testing';
import type { Entry, Profile, Scenario } from './types';

const scenario = (changes: Scenario['changes']): Scenario => ({ id: 's', name: 'teste', changes });
const added = (before: Profile, after: Profile) => after.installments.filter((i) => !before.installments.some((b) => b.id === i.id));

// Margin of 200/month after the first month: salary 6000 − rent 2000 − school 3000 − card 800.
const school: Entry = { id: 'escola', kind: 'out', name: 'Escola', amount: 3000, day: 15, recurrence: 'monthly', startMonth: '2026-01' };
const tight = () => makeProfile({ entries: [...makeProfile().entries, school] });

describe('applyChanges', () => {
  it('adds a purchase as installments from the invoice it lands in', () => {
    const base = makeProfile();
    const rows = added(base, applyChanges(base, [{ type: 'purchase', cardId: 'nu', total: 1200, installments: 12, date: '2026-11-05' }], TODAY));
    expect(rows).toHaveLength(12);
    expect(rows[0].dueMonth).toBe('2026-12');
    expect(rows[11].dueMonth).toBe('2027-11');
    expect(cents(rows.reduce((s, r) => s + r.amount, 0))).toBe(1200);
  });
  it('uses Price amounts for a purchase with interest', () => {
    const base = makeProfile();
    const rows = added(base, applyChanges(base, [{ type: 'purchase', cardId: 'nu', total: 1000, installments: 10, interestMonthly: 0.02 }], TODAY));
    expect(rows[0].amount).toBe(111.33);
  });
  it('turns a financing into a down payment plus a debt on the financed part', () => {
    const base = makeProfile();
    const after = applyChanges(base, [{
      type: 'debt', downPayment: 10000,
      debt: { name: 'Carro', kind: 'financiamento', principal: 50000, monthlyRate: 0.015, months: 48, system: 'price', startMonth: '2026-12', dueDay: 10 },
    }], TODAY);
    expect(after.debts).toHaveLength(1);
    expect(after.debts[0].principal).toBe(40000);
    expect(after.entries.find((e) => e.name === 'Entrada: Carro')).toMatchObject({ recurrence: 'once', amount: 10000, date: '2026-11-02' });
  });
  it('lowers income only inside the window of an income change', () => {
    const after = applyChanges(makeProfile(), [{ type: 'incomeChange', deltaPct: -0.3, months: 3, startMonth: '2026-12' }], TODAY);
    expect(netIncome(after, '2026-11', TODAY)).toBe(6000);
    expect(netIncome(after, '2026-12', TODAY)).toBe(4200);
    expect(netIncome(after, '2027-02', TODAY)).toBe(4200);
    expect(netIncome(after, '2027-03', TODAY)).toBe(6000);
  });
  it('adds a subscription, a cost increase and an emergency as entries', () => {
    const after = applyChanges(makeProfile(), [
      { type: 'subscription', amount: 55.9, day: 20 },
      { type: 'costChange', amount: 300, startMonth: '2027-01', category: 'alimentacao' },
      { type: 'emergency', amount: 2500, date: '2026-11-20' },
    ], TODAY);
    const names = after.entries.map((e) => [e.name, e.recurrence]);
    expect(names).toEqual(expect.arrayContaining([['Nova assinatura', 'monthly'], ['Aumento de custo de vida', 'monthly'], ['Imprevisto', 'once']]));
  });
  it('turns a partial payment into the capped worst case on the next invoices', () => {
    const after = applyChanges(makeProfile(), [{ type: 'payPartial', cardId: 'nu', dueMonth: '2026-11', payNow: 500, months: 6 }], TODAY);
    const plan = worstCase(1500, 6, after.parameters, TODAY);
    expect(invoiceFor(after, nubank, '2026-11', TODAY).cashOut).toBe(500);
    expect(invoiceFor(after, nubank, '2026-12', TODAY).total).toBe(cents(800 + plan.payments[0]));
  });
});

describe('evaluate', () => {
  it('finds the first negative month and the cushion of an income drop', () => {
    const r = evaluate(tight(), scenario([{ type: 'incomeChange', deltaPct: -0.3, months: 3, startMonth: '2026-12' }]), TODAY);
    expect(r.extras.incomeChange).toEqual({ firstNegativeMonth: '2027-01', cushionMonths: 1 });
    expect(r.verdict).toBe('risco');
  });
  it('measures how long the reserve lasts after an emergency', () => {
    const r = evaluate(makeProfile(), scenario([{ type: 'emergency', amount: 1000, date: '2026-11-20' }]), TODAY);
    // (3000 − 1000) / essentials of Nov (rent 2000 + invoice 2000)
    expect(r.extras.emergency?.reserveMonths).toBeCloseTo(0.5, 6);
  });
  it('reports limit, savings and the uncertainty range for a purchase', () => {
    const r = evaluate(makeProfile(), scenario([{ type: 'purchase', cardId: 'nu', total: 3000, installments: 3 }]), TODAY);
    expect(r.extras.purchase).toEqual({ firstMonth: '2026-11', monthlyInstallment: 1000, installments: 3 });
    // The whole purchase uses limit: 1000 on the open invoice + 2000 in future installments.
    expect(r.limitImpact[0].after.value).toBe(r.limitImpact[0].before.value - 3000);
    expect(r.savingsImpact).toBe(-3000);
    expect(r.uncertainty.low).toBeLessThanOrEqual(r.result.critical?.balance ?? 0);
    expect(r.uncertainty.high).toBeGreaterThanOrEqual(r.result.critical?.balance ?? 0);
  });
  it('reports the payment share of income for a financing', () => {
    const r = evaluate(makeProfile(), scenario([{
      type: 'debt', downPayment: 0,
      debt: { name: 'Carro', kind: 'financiamento', principal: 12000, monthlyRate: 0.01, months: 12, system: 'sac', startMonth: '2026-12', dueDay: 15 },
    }]), TODAY);
    expect(r.extras.debt).toMatchObject({ firstPayment: 1120, months: 12 });
    expect(r.extras.debt?.incomeShare).toBeCloseTo(1120 / 6000, 6);
  });
  it('lists the assumptions it used, with the worst-case rates for a partial payment', () => {
    const r = evaluate(makeProfile(), scenario([{ type: 'payPartial', cardId: 'nu', dueMonth: '2026-11', payNow: 500, months: 12 }]), TODAY);
    expect(r.extras.payPartial?.unpaid).toBe(1500);
    expect(r.assumptions.map((a) => a.key)).toContain('encargos_cap_ratio');
  });
  it('stays fast enough for live updates', () => {
    const many = makeProfile({
      cards: [nubank, { ...nubank, id: 'b', bank: 'Itaú' }, { ...nubank, id: 'c', bank: 'Inter' }],
      entries: Array.from({ length: 30 }, (_, k): Entry => ({ id: `e${k}`, kind: k % 3 ? 'out' : 'in', name: `x${k}`, amount: 100 + k, day: 1 + (k % 28), recurrence: 'monthly', startMonth: '2026-01' })),
    });
    const t0 = performance.now();
    evaluate(many, scenario([{ type: 'purchase', cardId: 'b', total: 2400, installments: 12 }]), TODAY);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe('scenarioRows', () => {
  it('returns exactly the rows a scenario adds or changes', () => {
    const base = makeProfile();
    const after = applyChanges(base, [{ type: 'incomeChange', deltaPct: -0.5, months: 2, startMonth: '2026-12' }, { type: 'subscription', amount: 30, day: 3 }], TODAY);
    const rows = scenarioRows(base, after);
    // salary split into: original (ends Nov), the reduced window, and the resumed salary; plus the subscription
    expect(rows.entries.map((e) => e.name).sort()).toEqual(['Nova assinatura', 'Salário', 'Salário', 'Salário']);
    expect(rows.entries.find((e) => e.id === 'sal')?.endMonth).toBe('2026-11');
    expect(rows.installments).toEqual([]);
  });
});
