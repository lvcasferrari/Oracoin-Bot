import { describe, expect, it } from 'vitest';
import { closingDate, dueDate, invoiceMonthForCharge } from './cycle';
import { DEFAULT_PARAMETERS } from './params';
import { nubank, TODAY } from './testing';
import type { Card, Parameter } from './types';

const flag0: Parameter[] = [
  ...DEFAULT_PARAMETERS,
  { key: 'purchase_on_closing_day_next_invoice', value: 0, effectiveFrom: '2026-10-27', source: 'teste' },
];
const late: Card = { ...nubank, id: 'late', closingDay: 28, dueDay: 5 };

describe('card cycle', () => {
  it('closes in the due month when the closing day comes first', () => {
    expect(closingDate(nubank, '2026-11')).toBe('2026-11-05');
    expect(dueDate(nubank, '2026-11')).toBe('2026-11-12');
  });
  it('closes in the previous month when the closing day is after the due day', () => {
    expect(closingDate(late, '2026-12')).toBe('2026-11-28');
  });
  it('clamps a closing day of 31 in a February cycle', () => {
    expect(closingDate({ ...nubank, closingDay: 31, dueDay: 10 }, '2026-03')).toBe('2026-02-28');
  });
  it('puts a charge before closing in the current invoice', () => {
    expect(invoiceMonthForCharge(nubank, '2026-11-03', DEFAULT_PARAMETERS, TODAY)).toBe('2026-11');
  });
  it('puts a charge on the closing day in the next invoice by default', () => {
    expect(invoiceMonthForCharge(nubank, '2026-11-05', DEFAULT_PARAMETERS, TODAY)).toBe('2026-12');
  });
  it('honours the closing-day parameter when set to 0', () => {
    expect(invoiceMonthForCharge(nubank, '2026-11-05', flag0, TODAY)).toBe('2026-11');
  });
  it('maps a charge to the next month when the card closes late', () => {
    expect(invoiceMonthForCharge(late, '2026-11-10', DEFAULT_PARAMETERS, TODAY)).toBe('2026-12');
  });
  it('maps a charge after a late closing two months ahead', () => {
    expect(invoiceMonthForCharge(late, '2026-11-29', DEFAULT_PARAMETERS, TODAY)).toBe('2027-01');
  });
});
