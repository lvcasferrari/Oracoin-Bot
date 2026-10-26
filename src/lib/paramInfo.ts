// Pure: how each parameter (premissa) is named, shown and edited in pt-BR.
import type { ParamKey } from '../engine';

type Unit = 'pctMonth' | 'pct' | 'months' | 'bool' | 'weight';

interface Info {
  label: string;
  unit: Unit;
  /** Allowed range in the unit the user types (percent for pct units). */
  min: number;
  max: number;
  group: string;
}

const RATES = 'Juros e teto';
const BANDS = 'Faixas e semáforo';
const SCORE = 'Saúde financeira';
const PROJ = 'Projeção';

export const PARAM_INFO: Record<ParamKey, Info> = {
  rotativo_monthly_rate: { label: 'Juros do rotativo', unit: 'pctMonth', min: 0, max: 100, group: RATES },
  parcelado_fatura_monthly_rate: { label: 'Juros do parcelamento da fatura', unit: 'pctMonth', min: 0, max: 100, group: RATES },
  encargos_cap_ratio: { label: 'Teto dos encargos sobre o valor em aberto', unit: 'pct', min: 0, max: 1000, group: RATES },
  partial_plan_default_months: { label: 'Parcelas padrão do parcelamento da fatura', unit: 'months', min: 1, max: 24, group: RATES },
  projection_months: { label: 'Meses de projeção', unit: 'months', min: 18, max: 60, group: PROJ },
  commitment_band_yellow: { label: 'Comprometimento: início do amarelo', unit: 'pct', min: 0, max: 100, group: BANDS },
  commitment_band_orange: { label: 'Comprometimento: início do laranja', unit: 'pct', min: 0, max: 100, group: BANDS },
  commitment_band_red: { label: 'Comprometimento: início do vermelho', unit: 'pct', min: 0, max: 100, group: BANDS },
  verdict_tight_income_share: { label: 'Saldo mínimo abaixo do qual "aperta" (parte da renda)', unit: 'pct', min: 0, max: 100, group: BANDS },
  verdict_attention_income_share: { label: 'Saldo mínimo abaixo do qual pede "atenção" (parte da renda)', unit: 'pct', min: 0, max: 100, group: BANDS },
  verdict_limit_tight: { label: 'Uso do limite que "aperta"', unit: 'pct', min: 0, max: 100, group: BANDS },
  verdict_limit_attention: { label: 'Uso do limite que pede "atenção"', unit: 'pct', min: 0, max: 100, group: BANDS },
  reserve_target_months: { label: 'Meses de reserva para nota máxima', unit: 'months', min: 1, max: 24, group: SCORE },
  score_weight_controle: { label: 'Peso: controle do dia a dia', unit: 'weight', min: 0, max: 10, group: SCORE },
  score_weight_colchao: { label: 'Peso: colchão para imprevistos', unit: 'weight', min: 0, max: 10, group: SCORE },
  score_weight_metas: { label: 'Peso: metas', unit: 'weight', min: 0, max: 10, group: SCORE },
  score_weight_liberdade: { label: 'Peso: liberdade de escolha', unit: 'weight', min: 0, max: 10, group: SCORE },
  controle_full_margin_share: { label: 'Sobra do mês para nota máxima (parte da renda)', unit: 'pct', min: 1, max: 100, group: SCORE },
  rotativo_lookback_months: { label: 'Meses em que um pagamento parcial pesa na nota', unit: 'months', min: 0, max: 24, group: SCORE },
  variable_estimate_uncertainty: { label: 'Incerteza do gasto variável do cartão', unit: 'pct', min: 0, max: 100, group: PROJ },
  purchase_on_closing_day_next_invoice: { label: 'Compra no dia do fechamento entra na fatura seguinte', unit: 'bool', min: 0, max: 1, group: PROJ },
};

const num = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function displayParam(key: ParamKey, value: number): string {
  const { unit } = PARAM_INFO[key];
  if (unit === 'pctMonth') return `${num(value * 100)}% ao mês`;
  if (unit === 'pct') return `${num(value * 100)}%`;
  if (unit === 'months') return `${value} ${value === 1 ? 'mês' : 'meses'}`;
  if (unit === 'bool') return value >= 0.5 ? 'Sim' : 'Não';
  return num(value);
}

/** Text to prefill the edit field (percent units are shown in percent). */
export function paramInput(key: ParamKey, value: number): string {
  const { unit } = PARAM_INFO[key];
  const shown = unit === 'pct' || unit === 'pctMonth' ? Math.round(value * 1e6) / 1e4 : value;
  return String(shown).replace('.', ',');
}

/** Parses what the user typed back into the stored value; null when invalid or out of range. */
export function parseParamInput(key: ParamKey, text: string): number | null {
  const { unit, min, max } = PARAM_INFO[key];
  const s = text.trim().replace('%', '').replace(/\./g, '').replace(',', '.');
  if (unit === 'bool') return /^sim$/i.test(text.trim()) ? 1 : /^n[aã]o$/i.test(text.trim()) ? 0 : null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const typed = Number(s);
  if (typed < min || typed > max) return null;
  if (unit === 'months' && !Number.isInteger(typed)) return null;
  return unit === 'pct' || unit === 'pctMonth' ? Math.round(typed * 1e4) / 1e6 : typed;
}
