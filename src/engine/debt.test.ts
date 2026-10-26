import { describe, expect, it } from 'vitest';
import { cents } from './dates';
import { debtSummary, priceSchedule, sacSchedule } from './debt';
import { buildEvents } from './events';
import { freeMargin } from './metrics';
import { makeProfile, TODAY } from './testing';
import type { Debt } from './types';

describe('Price', () => {
  it('has a fixed payment of 945.60 for 10000 at 2% in 12x', () => {
    const rows = priceSchedule(10000, 0.02, 12);
    expect(rows[0].payment).toBe(945.6);
    const s = debtSummary(rows);
    expect(cents(s.totalPaid - 10000)).toBe(s.totalInterest);
  });
  it('splits evenly without interest', () => {
    expect(priceSchedule(1200, 0, 12).every((r) => r.payment === 100)).toBe(true);
  });
  it('handles a single payment', () => {
    expect(priceSchedule(1000, 0.02, 1)[0].payment).toBe(1020);
  });
});

describe('SAC', () => {
  it('starts at 1120 and ends at 1010 for 12000 at 1% in 12x', () => {
    const s = debtSummary(sacSchedule(12000, 0.01, 12));
    expect(s.firstPayment).toBe(1120);
    expect(s.lastPayment).toBe(1010);
  });
});

describe('both systems', () => {
  it('end at a balance of exactly zero with awkward inputs', () => {
    expect(priceSchedule(1000, 0.0333, 7).at(-1)?.balance).toBe(0);
    expect(sacSchedule(1000, 0.0333, 7).at(-1)?.balance).toBe(0);
  });
  it('reject invalid inputs', () => {
    expect(() => priceSchedule(-1, 0.01, 12)).toThrow(RangeError);
    expect(() => sacSchedule(1000, 0.01, 0)).toThrow(RangeError);
  });
});

describe('debts in the cash flow', () => {
  const debt: Debt = {
    id: 'carro', name: 'Financiamento do carro', kind: 'financiamento',
    principal: 12000, monthlyRate: 0.01, months: 12, system: 'sac', startMonth: '2026-12', dueDay: 15,
  };
  it('pays only within the debt months, on its due day', () => {
    const events = buildEvents(makeProfile({ debts: [debt] }), TODAY).filter((e) => e.source === 'debt');
    expect(events).toHaveLength(12);
    expect(events[0]).toMatchObject({ date: '2026-12-15', amount: -1120 });
    expect(events.at(-1)?.date).toBe('2027-11-15');
  });
  it('is subtracted from the free margin', () => {
    // 6000 − 2000 rent − 800 invoice − 1120 debt
    expect(freeMargin(makeProfile({ debts: [debt] }), '2026-12', TODAY)).toBe(2080);
  });
});
