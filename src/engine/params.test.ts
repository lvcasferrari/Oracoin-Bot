import { describe, expect, it } from 'vitest';
import { annualToMonthly, DEFAULT_PARAMETERS, MissingParameterError, param } from './params';
import { PARAM_KEYS, type Parameter } from './types';

const rows: Parameter[] = [
  { key: 'projection_months', value: 18, effectiveFrom: '2026-01-01', source: 't' },
  { key: 'projection_months', value: 24, effectiveFrom: '2026-06-01', source: 't' },
  { key: 'projection_months', value: 30, effectiveFrom: '2027-01-01', source: 't' },
];

describe('param()', () => {
  it('picks the latest value effective on or before the date', () => {
    expect(param(rows, 'projection_months', '2026-11-01')).toBe(24);
    expect(param(rows, 'projection_months', '2026-06-01')).toBe(24);
  });
  it('throws on a missing key instead of defaulting', () => {
    expect(() => param([], 'projection_months', '2026-11-01')).toThrow(MissingParameterError);
  });
  it('throws when every value takes effect after the date', () => {
    expect(() => param(rows, 'projection_months', '2025-12-31')).toThrow(MissingParameterError);
  });
});

describe('annualToMonthly', () => {
  it('converts the BCB annual averages of ago/2026', () => {
    expect(annualToMonthly(4.449)).toBeCloseTo(0.1518, 4);
    expect(annualToMonthly(1.921)).toBeCloseTo(0.0934, 4);
  });
});

describe('DEFAULT_PARAMETERS', () => {
  it('gives every default a source and a valid effective date', () => {
    for (const p of DEFAULT_PARAMETERS) {
      expect(p.source.trim()).not.toBe('');
      expect(p.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(p.value)).toBe(true);
    }
  });
  it('has exactly one default per parameter key', () => {
    const keys = DEFAULT_PARAMETERS.map((p) => p.key).sort();
    expect(keys).toEqual([...PARAM_KEYS].sort());
  });
});
