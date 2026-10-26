import { cents, monthOf, addMonths } from './dates';
import { invoiceMonthForCharge } from './cycle';
import { buildEvents, criticalDay, profileBalance } from './events';
import { netIncome } from './metrics';
import { param } from './params';
import type { Installment, ParamKey, Parameter, Profile } from './types';

export interface PurchaseScenario {
  cardId: string;
  total: number;
  installments: number;
  /** Purchase date; defaults to today. */
  date?: string;
}

export type Verdict = 'confortavel' | 'atencao' | 'aperta' | 'risco';

export interface PurchaseResult {
  monthlyInstallment: number;
  /** Invoice month of the first installment. */
  firstMonth: string;
  /** Lowest projected balance before the purchase. */
  baselineLow: number;
  /** Lowest projected balance after the purchase. */
  scenarioLow: number;
  /** Share of the card limit the purchase commits. */
  limitShare: number;
  verdict: Verdict;
}

/** Equal installments with the rounding remainder on the first one. */
export function splitInstallments(total: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('installments must be a positive integer');
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('total must be positive');
  const base = cents(total / n);
  const remainder = cents(total - base * n);
  return Array.from({ length: n }, (_, k) => (k === 0 ? cents(base + remainder) : base));
}

/** "E se eu comprar parcelado?" Compares the lowest projected balance with and without the purchase. */
export function simulatePurchase(profile: Profile, scenario: PurchaseScenario, today: string): PurchaseResult {
  const card = profile.cards.find((c) => c.id === scenario.cardId);
  if (!card) throw new Error(`Unknown card ${scenario.cardId}`);
  const parts = splitInstallments(scenario.total, scenario.installments);
  const firstMonth = invoiceMonthForCharge(card, scenario.date ?? today, profile.parameters, today);
  const added: Installment[] = parts.map((amount, k) => ({
    id: `sim-${k}`,
    cardId: card.id,
    dueMonth: addMonths(firstMonth, k),
    amount,
  }));
  const withPurchase: Profile = { ...profile, installments: [...profile.installments, ...added] };

  const start = profileBalance(profile);
  const baselineLow = criticalDay(start, buildEvents(profile, today))?.balance ?? start;
  const scenarioLow = criticalDay(start, buildEvents(withPurchase, today))?.balance ?? start;
  const limitShare = card.limit > 0 ? scenario.total / card.limit : Infinity;
  const income = netIncome(profile, monthOf(today), today);

  return {
    monthlyInstallment: parts[parts.length - 1],
    firstMonth,
    baselineLow,
    scenarioLow,
    limitShare,
    verdict: verdictFor(scenarioLow, income, limitShare, profile.parameters, today),
  };
}

/** Semáforo from the lowest projected balance and the limit share (always shown with text). */
export function verdictFor(scenarioLow: number, income: number, limitShare: number, params: Parameter[], today: string): Verdict {
  const p = (key: ParamKey) => param(params, key, today);
  if (scenarioLow < 0 || limitShare > 1) return 'risco';
  if (scenarioLow < income * p('verdict_tight_income_share') || limitShare > p('verdict_limit_tight')) return 'aperta';
  if (scenarioLow < income * p('verdict_attention_income_share') || limitShare > p('verdict_limit_attention')) return 'atencao';
  return 'confortavel';
}
