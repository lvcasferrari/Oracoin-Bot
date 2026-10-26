import { describe, expect, it } from 'vitest';
import {
  addMonths,
  buildEvents,
  cashProjection,
  commitmentRatio,
  criticalDay,
  dateInMonth,
  freeMargin,
  invoiceAmount,
} from './engine';
import { simulatePurchase, verdictFor } from './simulator';
import type { Profile } from './types';

const card = { id: 'nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 10000, variableEstimate: 800 };

const profile: Profile = {
  netIncome: 6000,
  incomes: [{ name: 'Salário', amount: 6000, day: 5 }],
  outflows: [{ name: 'Aluguel', amount: 2000, day: 10 }],
  cards: [card],
  installments: [{ cardId: 'nu', dueMonth: '2026-11', amount: 1200 }],
  balance: 3000,
  balanceDate: '2026-11-01',
};

describe('dates', () => {
  it('clamps the day to the last day of the month', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
  });
  it('rolls months across the year boundary', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
  });
});

describe('invoices', () => {
  it('sums installments due in the month plus the variable estimate', () => {
    expect(invoiceAmount(card, profile.installments, '2026-11')).toBe(2000);
  });
  it('uses only the variable estimate when no installment falls in the month', () => {
    expect(invoiceAmount(card, profile.installments, '2026-12')).toBe(800);
  });
});

describe('cash projection', () => {
  it('pays the invoice on the due day, not the purchase date', () => {
    const events = buildEvents(profile, '2026-11-01', 1);
    const invoice = events.find((e) => e.label.startsWith('Fatura'));
    expect(invoice?.date).toBe('2026-11-12');
    expect(invoice?.amount).toBe(-2000);
  });
  it('finds the critical day as the lowest balance', () => {
    const events = buildEvents(profile, '2026-11-01', 1);
    // 3000 + 6000 (5th) - 2000 (10th) - 2000 invoice (12th): lowest is the 12th
    const low = criticalDay(profile.balance, events);
    expect(low?.date).toBe('2026-11-12');
    expect(low?.balance).toBe(5000);
  });
  it('is empty-safe with no events', () => {
    expect(cashProjection(100, [])).toEqual([]);
    expect(criticalDay(100, [])).toBeNull();
  });
});

describe('ratios and margins', () => {
  it('computes commitment as share of net income', () => {
    expect(commitmentRatio(3000, 6000)).toBe(0.5);
  });
  it('treats zero income as infinite commitment', () => {
    expect(commitmentRatio(100, 0)).toBe(Infinity);
  });
  it('computes free margin = income − fixed − invoices − savings', () => {
    // 6000 − 2000 − 2000 (Nov invoice) − 500 savings
    expect(freeMargin(profile, '2026-11', 500)).toBe(1500);
  });
});

describe('simulator', () => {
  it('spreads a purchase into equal installments with the remainder on the first', () => {
    const result = simulatePurchase(
      profile,
      { cardId: 'nu', total: 1000, installments: 3, firstMonth: '2026-12' },
      '2026-11-01',
    );
    expect(result.monthlyInstallment).toBe(333.33);
  });
  it('lowers the critical balance when a purchase is added', () => {
    const result = simulatePurchase(
      profile,
      { cardId: 'nu', total: 3000, installments: 3, firstMonth: '2026-11' },
      '2026-11-01',
    );
    expect(result.scenarioLow).toBeLessThan(result.baselineLow);
  });
  it('marks a purchase over the card limit as risk', () => {
    const result = simulatePurchase(
      profile,
      { cardId: 'nu', total: 12000, installments: 12, firstMonth: '2026-12' },
      '2026-11-01',
    );
    expect(result.verdict).toBe('risco');
  });
});

describe('verdict (semáforo)', () => {
  it('is comfortable with ample balance and low limit use', () => {
    expect(verdictFor(5000, 6000, 0.1)).toBe('confortavel');
  });
  it('is risk when the balance goes negative', () => {
    expect(verdictFor(-1, 6000, 0.1)).toBe('risco');
  });
});
