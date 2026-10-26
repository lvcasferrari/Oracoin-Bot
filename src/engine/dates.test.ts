import { describe, expect, it } from 'vitest';
import { addDays, addMonths, cents, dateInMonth, monthDiff, todayLocal } from './dates';

describe('dates', () => {
  it('clamps the day to the last day of the month', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2028-02', 31)).toBe('2028-02-29');
  });
  it('adds months across year boundaries in both directions', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
  it('counts whole months between two months', () => {
    expect(monthDiff('2026-11', '2027-02')).toBe(3);
    expect(monthDiff('2027-02', '2026-11')).toBe(-3);
  });
  it('adds days across a month boundary', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
  it('returns the local calendar date, not the UTC one (TZ=America/Sao_Paulo)', () => {
    // 01:30 UTC on Nov 2 is still 22:30 on Nov 1 in São Paulo.
    expect(todayLocal(new Date('2026-11-02T01:30:00Z'))).toBe('2026-11-01');
  });
  it('rounds to cents without float drift', () => {
    expect(cents(0.1 + 0.2)).toBe(0.3);
  });
});
