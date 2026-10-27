import { describe, expect, it } from 'vitest';
import { formatMonthBR, parseDateBR, parseDay, parseMonthBR, shortMonth } from './dateInput';
import { fillSameAmount } from './fill';
import { parseBRL, toInput } from './money';

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['0,5', 0.5],
    ['1234', 1234],
    ['R$ 99,90', 99.9],
    ['1.000', 1000],
    ['12.5', 12.5],
  ])('reads %s as %s', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });
  it.each(['', 'abc', '-1', '2.000.000.000', '1,2,3'])('rejects %s', (input) => {
    expect(parseBRL(input)).toBeNull();
  });
  it('round-trips through the input format', () => {
    expect(parseBRL(toInput(1234.5))).toBe(1234.5);
  });
});

describe('date inputs', () => {
  it('parses month and date in pt-BR order', () => {
    expect(parseMonthBR('11/2026')).toBe('2026-11');
    expect(parseMonthBR('13/2026')).toBeNull();
    expect(parseDateBR('05/11/2026')).toBe('2026-11-05');
    expect(parseDateBR('31/02/2026')).toBeNull();
  });
  it('accepts days 1–31 only', () => {
    expect(parseDay('31')).toBe(31);
    expect(parseDay('0')).toBeNull();
    expect(parseDay('3a')).toBeNull();
  });
  it('formats months for display', () => {
    expect(formatMonthBR('2026-11')).toBe('11/2026');
    expect(shortMonth('2027-02')).toBe('fev/27');
  });
});

describe('fillSameAmount', () => {
  it('fills N consecutive months across a year boundary', () => {
    expect(fillSameAmount({ '2026-10': '5' }, '2026-11', 3, '100')).toEqual({ '2026-10': '5', '2026-11': '100', '2026-12': '100', '2027-01': '100' });
  });
  it('rejects a non-positive count', () => {
    expect(() => fillSameAmount({}, '2026-11', 0, '1')).toThrow(RangeError);
  });
});
