import { addMonths, clamp, monthOf } from './dates';
import { profileBalance } from './events';
import { contributions, goalTimeline, onTrack } from './goals';
import { commitmentRatio, essentialOutflows, freeMargin, netIncome } from './metrics';
import { param } from './params';
import type { ParamKey, Profile } from './types';

export type ScorePart = 'controle' | 'colchao' | 'metas' | 'liberdade';

export interface HealthScore {
  total: number;
  parts: Record<ScorePart, number>;
  noGoals: boolean;
  topImprovement: string;
}

const IMPROVE: Record<ScorePart, string> = {
  controle: 'Aumentar a sobra do mês é o que mais melhora sua nota.',
  colchao: 'Formar uma reserva para imprevistos é o que mais melhora sua nota.',
  metas: 'Colocar suas metas no ritmo do prazo é o que mais melhora sua nota.',
  liberdade: 'Diminuir o quanto faturas e dívidas levam da renda é o que mais melhora sua nota.',
};

/**
 * Health score from the four CFPB well-being elements (spec 05), 0–100 each. Weights and cuts
 * are parameters ("referência do app"); nothing here is an official standard.
 */
export function healthScore(profile: Profile, today: string): HealthScore {
  const p = (key: ParamKey) => param(profile.parameters, key, today);
  const month = monthOf(today);
  const income = netIncome(profile, month, today);
  const margin = freeMargin(profile, month, today);

  const controle = income <= 0 || margin < 0 ? 0 : clamp(margin / income / p('controle_full_margin_share'), 0, 1) * 100;

  const essentials = essentialOutflows(profile, month, today);
  const colchao = essentials <= 0 ? 100 : clamp(profileBalance(profile) / essentials / p('reserve_target_months'), 0, 1) * 100;

  const timeline = goalTimeline(profile.goals, contributions(profile, today));
  const metas = timeline.length === 0 ? 100 : (100 * timeline.filter(onTrack).length) / timeline.length;

  const lookbackStart = addMonths(month, -p('rotativo_lookback_months'));
  const recentPartial = profile.invoices.some((i) => i.status === 'parcial' && i.dueMonth >= lookbackStart && i.dueMonth <= month);
  const ratio = commitmentRatio(profile, month, today);
  const yellow = p('commitment_band_yellow');
  const red = p('commitment_band_red');
  // Bands edited into the same value would divide by zero; then it is simply above or below the cut.
  const freedom = red > yellow ? clamp((red - ratio) / (red - yellow), 0, 1) : ratio < red ? 1 : 0;
  const liberdade = income <= 0 || recentPartial ? 0 : freedom * 100;

  const parts: Record<ScorePart, number> = {
    controle: Math.round(controle),
    colchao: Math.round(colchao),
    metas: Math.round(metas),
    liberdade: Math.round(liberdade),
  };
  const weights: Record<ScorePart, number> = {
    controle: p('score_weight_controle'),
    colchao: p('score_weight_colchao'),
    metas: p('score_weight_metas'),
    liberdade: p('score_weight_liberdade'),
  };
  const keys = Object.keys(parts) as ScorePart[];
  const weightSum = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0);
  const w = (k: ScorePart) => (weightSum > 0 ? Math.max(0, weights[k]) / weightSum : 1 / keys.length);
  const total = Math.round(keys.reduce((s, k) => s + w(k) * parts[k], 0));

  const gaps = keys.map((k) => ({ k, gap: w(k) * (100 - parts[k]) })).sort((a, b) => b.gap - a.gap);
  const topImprovement = gaps[0].gap > 0 ? IMPROVE[gaps[0].k] : 'Tudo em dia. Mantenha o ritmo.';

  return { total, parts, noGoals: timeline.length === 0, topImprovement };
}

export interface ScoreSnapshotLike {
  month: string;
  total: number;
}

/** "↑ 6 pontos em 3 meses": compares with the snapshot 3 months back (or the oldest one since). */
export function scoreTrend(history: ScoreSnapshotLike[], month: string, current: number): string | null {
  const earlier = history.filter((h) => h.month >= addMonths(month, -3) && h.month < month).sort((a, b) => (a.month < b.month ? -1 : 1))[0];
  if (!earlier) return null;
  const diff = current - earlier.total;
  const span = Math.max(1, (Number(month.slice(0, 4)) - Number(earlier.month.slice(0, 4))) * 12 + Number(month.slice(5)) - Number(earlier.month.slice(5)));
  const when = span === 1 ? 'em 1 mês' : `em ${span} meses`;
  if (diff === 0) return `Estável ${when}.`;
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'ponto' : 'pontos'} ${when}.`;
}
