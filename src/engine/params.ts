import type { ParamKey, Parameter } from './types';

export class MissingParameterError extends Error {
  constructor(key: ParamKey, onDate: string) {
    super(`Parameter "${key}" has no value effective on ${onDate}`);
    this.name = 'MissingParameterError';
  }
}

/** Source of every parameter row the user edits. */
export const USER_PARAMETER_SOURCE = 'editado por você';

/**
 * The row of `key` with the latest `effectiveFrom` on or before `onDate`; on the same date the
 * user's edit wins over the seeded default. Never defaults.
 */
export function paramRow(params: Parameter[], key: ParamKey, onDate: string): Parameter {
  let best: Parameter | undefined;
  for (const p of params) {
    if (p.key !== key || p.effectiveFrom > onDate) continue;
    if (!best || p.effectiveFrom > best.effectiveFrom || (p.effectiveFrom === best.effectiveFrom && p.source === USER_PARAMETER_SOURCE)) best = p;
  }
  if (!best) throw new MissingParameterError(key, onDate);
  return best;
}

export const param = (params: Parameter[], key: ParamKey, onDate: string): number => paramRow(params, key, onDate).value;

/** Equivalent monthly rate of an annual rate: (1 + a)^(1/12) − 1. */
export const annualToMonthly = (annual: number): number => (1 + annual) ** (1 / 12) - 1;

const APP = 'referência do app';
const SET = '2026-10-26';

// Data, not logic. Changing a value here also needs a DB migration inserting a new dated row.
export const DEFAULT_PARAMETERS: Parameter[] = [
  { key: 'rotativo_monthly_rate', value: 0.1518, effectiveFrom: '2026-08-01', source: 'BCB ago/2026: 444,9% a.a. convertido para a.m.' },
  { key: 'parcelado_fatura_monthly_rate', value: 0.0934, effectiveFrom: '2026-08-01', source: 'BCB ago/2026: 192,1% a.a. convertido para a.m.' },
  { key: 'encargos_cap_ratio', value: 1, effectiveFrom: '2024-01-03', source: 'Lei 14.690/2023, Res. CMN 5.112; texto a confirmar' },
  { key: 'partial_plan_default_months', value: 12, effectiveFrom: SET, source: 'suposição do app' },
  { key: 'projection_months', value: 18, effectiveFrom: SET, source: 'spec 05: cobre parcelas de 12x e mais' },
  { key: 'commitment_band_yellow', value: 0.2, effectiveFrom: SET, source: APP },
  { key: 'commitment_band_orange', value: 0.3, effectiveFrom: SET, source: `${APP} (regra de 30% da renda, B3/Bora Investir)` },
  { key: 'commitment_band_red', value: 0.5, effectiveFrom: SET, source: `${APP} (sinal de alerta usado pela CNC)` },
  { key: 'verdict_tight_income_share', value: 0.1, effectiveFrom: SET, source: APP },
  { key: 'verdict_attention_income_share', value: 0.25, effectiveFrom: SET, source: APP },
  { key: 'verdict_limit_tight', value: 0.7, effectiveFrom: SET, source: APP },
  { key: 'verdict_limit_attention', value: 0.4, effectiveFrom: SET, source: APP },
  { key: 'reserve_target_months', value: 6, effectiveFrom: SET, source: APP },
  { key: 'score_weight_controle', value: 0.25, effectiveFrom: SET, source: APP },
  { key: 'score_weight_colchao', value: 0.25, effectiveFrom: SET, source: APP },
  { key: 'score_weight_metas', value: 0.25, effectiveFrom: SET, source: APP },
  { key: 'score_weight_liberdade', value: 0.25, effectiveFrom: SET, source: APP },
  { key: 'controle_full_margin_share', value: 0.2, effectiveFrom: SET, source: APP },
  { key: 'rotativo_lookback_months', value: 3, effectiveFrom: SET, source: APP },
  { key: 'variable_estimate_uncertainty', value: 0.2, effectiveFrom: SET, source: 'suposição do app' },
  { key: 'purchase_on_closing_day_next_invoice', value: 1, effectiveFrom: SET, source: 'sem fonte citável; editável (0 ou 1)' },
  { key: 'best_day_max_wait_days', value: 7, effectiveFrom: '2026-10-27', source: APP },
];
