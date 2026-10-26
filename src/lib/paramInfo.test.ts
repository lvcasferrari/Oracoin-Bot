import { describe, expect, it } from 'vitest';
import { PARAM_KEYS } from '../engine';
import { displayParam, PARAM_INFO, paramInput, parseParamInput } from './paramInfo';

describe('parameter display and editing', () => {
  it('describes every parameter key', () => {
    expect(Object.keys(PARAM_INFO).sort()).toEqual([...PARAM_KEYS].sort());
  });
  it('shows rates and shares in percent', () => {
    expect(displayParam('rotativo_monthly_rate', 0.1518)).toBe('15,18% ao mês');
    expect(displayParam('commitment_band_red', 0.5)).toBe('50%');
    expect(displayParam('projection_months', 18)).toBe('18 meses');
    expect(displayParam('purchase_on_closing_day_next_invoice', 1)).toBe('Sim');
  });
  it('round-trips a percent through the edit field', () => {
    expect(paramInput('rotativo_monthly_rate', 0.1518)).toBe('15,18');
    expect(parseParamInput('rotativo_monthly_rate', '15,18')).toBe(0.1518);
    expect(parseParamInput('rotativo_monthly_rate', '12%')).toBe(0.12);
  });
  it('rejects values out of range or of the wrong kind', () => {
    expect(parseParamInput('projection_months', '12')).toBeNull(); // spec 05: at least 18
    expect(parseParamInput('projection_months', '18,5')).toBeNull();
    expect(parseParamInput('commitment_band_red', '150')).toBeNull();
    expect(parseParamInput('rotativo_monthly_rate', 'abc')).toBeNull();
  });
  it('reads Sim/Não for yes/no parameters', () => {
    expect(parseParamInput('purchase_on_closing_day_next_invoice', 'Não')).toBe(0);
    expect(parseParamInput('purchase_on_closing_day_next_invoice', 'sim')).toBe(1);
  });
});
