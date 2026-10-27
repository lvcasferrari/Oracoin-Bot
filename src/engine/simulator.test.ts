import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMETERS } from './params';
import { simulatePurchase, splitInstallments, verdictFor } from './simulator';
import { makeProfile, TODAY } from './testing';

describe('purchase simulator', () => {
  it('splits into equal installments with the remainder on the first', () => {
    expect(splitInstallments(1000, 3)).toEqual([333.34, 333.33, 333.33]);
  });
  it('rejects invalid installment counts and totals', () => {
    expect(() => splitInstallments(1000, 0)).toThrow(RangeError);
    expect(() => splitInstallments(-5, 2)).toThrow(RangeError);
  });
  it('reports the monthly installment and the first invoice month', () => {
    const r = simulatePurchase(makeProfile(), { cardId: 'nu', total: 1000, installments: 3 }, TODAY);
    expect(r.monthlyInstallment).toBe(333.33);
    expect(r.firstMonth).toBe('2026-11');
  });
  it('starts on the next invoice when bought on the closing day', () => {
    const r = simulatePurchase(makeProfile(), { cardId: 'nu', total: 1000, installments: 2, date: '2026-11-05' }, TODAY);
    expect(r.firstMonth).toBe('2026-12');
  });
  it('lowers the critical balance when a purchase is added', () => {
    const r = simulatePurchase(makeProfile(), { cardId: 'nu', total: 3000, installments: 3 }, TODAY);
    expect(r.baselineLow).toBe(5000);
    expect(r.scenarioLow).toBe(4000);
  });
  it('marks a purchase over the card limit as risk', () => {
    const r = simulatePurchase(makeProfile(), { cardId: 'nu', total: 12000, installments: 12 }, TODAY);
    expect(r.verdict).toBe('risco');
  });
});

describe('verdict (semáforo)', () => {
  it('is comfortable with ample balance and low limit use', () => {
    expect(verdictFor(5000, 6000, 0.1, DEFAULT_PARAMETERS, TODAY)).toBe('confortavel');
  });
  it('is risk when the balance goes negative', () => {
    expect(verdictFor(-1, 6000, 0.1, DEFAULT_PARAMETERS, TODAY)).toBe('risco');
  });
  it('reads its thresholds from parameters', () => {
    const stricter = [
      ...DEFAULT_PARAMETERS,
      { key: 'verdict_attention_income_share' as const, value: 1, effectiveFrom: '2026-10-30', source: 'teste' },
    ];
    expect(verdictFor(5000, 6000, 0.1, stricter, TODAY)).toBe('atencao');
  });
});
