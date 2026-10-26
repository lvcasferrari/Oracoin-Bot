import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMETERS } from './params';
import { makeProfile, nubank } from './testing';
import { forecastError, invoicesToConfirm } from './upkeep';
import type { Invoice } from './types';

const confirmed = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'i', cardId: 'nu', dueMonth: '2026-11', amount: 2100, origin: 'confirmada', status: 'fechada', estimatedAtConfirm: 2000, ...overrides,
});

describe('invoicesToConfirm', () => {
  // Nubank closes on the 5th and is due on the 12th.
  it('asks nothing before the closing day', () => {
    expect(invoicesToConfirm(makeProfile(), '2026-11-04')).toEqual([]);
  });
  it('asks on the closing day, with the projection as the estimate', () => {
    expect(invoicesToConfirm(makeProfile(), '2026-11-05')).toEqual([{ card: nubank, dueMonth: '2026-11', dueDate: '2026-11-12', estimate: 2000 }]);
  });
  it('waits for the day after closing when the closing-day parameter is 0', () => {
    const params = [...DEFAULT_PARAMETERS, { key: 'purchase_on_closing_day_next_invoice' as const, value: 0, effectiveFrom: '2026-10-27', source: 't' }];
    expect(invoicesToConfirm(makeProfile({ parameters: params }), '2026-11-05')).toEqual([]);
    expect(invoicesToConfirm(makeProfile({ parameters: params }), '2026-11-06')).toHaveLength(1);
  });
  it('still asks on the due date and stops after it', () => {
    expect(invoicesToConfirm(makeProfile(), '2026-11-12')).toHaveLength(1);
    expect(invoicesToConfirm(makeProfile(), '2026-11-13')).toEqual([]);
  });
  it('handles a closing day of 31 in a 30-day month', () => {
    const card = { ...nubank, closingDay: 31, dueDay: 10 };
    const due = invoicesToConfirm(makeProfile({ cards: [card], installments: [] }), '2026-11-30');
    expect(due.map((d) => d.dueMonth)).toEqual(['2026-12']);
  });
  it('keeps asking while only the user estimate is stored, and stops once confirmed', () => {
    const estimated = confirmed({ origin: 'estimada', amount: 1800, estimatedAtConfirm: undefined });
    expect(invoicesToConfirm(makeProfile({ invoices: [estimated] }), '2026-11-06')[0].estimate).toBe(1800);
    expect(invoicesToConfirm(makeProfile({ invoices: [confirmed()] }), '2026-11-06')).toEqual([]);
  });
});

describe('forecastError', () => {
  it('is null with nothing confirmed', () => {
    expect(forecastError([])).toBeNull();
  });
  it('averages the absolute error in reais and in share of the real amount', () => {
    const r = forecastError([confirmed(), confirmed({ id: 'j', dueMonth: '2026-12', amount: 1000, estimatedAtConfirm: 1100 })]);
    expect(r).toEqual({ count: 2, meanAbs: 100, meanPct: (100 / 2100 + 100 / 1000) / 2 });
  });
});
