import { describe, expect, it } from 'vitest';
import { commitmentRatio, freeMargin, netIncome, payday } from './metrics';
import { makeProfile, TODAY } from './testing';

const income = (id: string, amount: number, day: number) =>
  ({ id, kind: 'in', name: id, amount, day, recurrence: 'monthly', startMonth: '2026-01' }) as const;

describe('metrics', () => {
  it('sums the month inflows as net income', () => {
    expect(netIncome(makeProfile(), '2026-11', TODAY)).toBe(6000);
  });
  it('computes free margin as income − outflows − invoices', () => {
    // 6000 − 2000 rent − 2000 invoice
    expect(freeMargin(makeProfile(), '2026-11', TODAY)).toBe(2000);
  });
  it('computes commitment as (invoices + debts) ÷ income', () => {
    expect(commitmentRatio(makeProfile(), '2026-11', TODAY)).toBeCloseTo(2000 / 6000, 6);
  });
  it('treats zero income as infinite commitment', () => {
    const profile = makeProfile({ entries: makeProfile().entries.filter((e) => e.kind === 'out') });
    expect(commitmentRatio(profile, '2026-11', TODAY)).toBe(Infinity);
  });
  it('takes payday from the largest monthly income, earliest day on a tie', () => {
    expect(payday(makeProfile({ entries: [income('a', 6000, 5), income('b', 1500, 20)] }))).toBe(5);
    expect(payday(makeProfile({ entries: [income('a', 6000, 20), income('b', 6000, 5)] }))).toBe(5);
  });
  it('has no payday without income', () => {
    expect(payday(makeProfile({ entries: [] }))).toBeNull();
  });
});
