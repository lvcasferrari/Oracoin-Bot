import { addMonths, cents, buildEvents, criticalDay, monthOf } from './engine';
import type { Profile, Installment } from './types';

export interface PurchaseScenario {
  cardId: string;
  total: number;
  installments: number;
  /** Invoice month of the first installment, "YYYY-MM". */
  firstMonth: string;
}

export type Verdict = 'confortavel' | 'atencao' | 'aperta' | 'risco';

export interface PurchaseResult {
  monthlyInstallment: number;
  /** Lowest projected balance before the purchase. */
  baselineLow: number;
  /** Lowest projected balance after the purchase. */
  scenarioLow: number;
  /** Limit that the purchase commits on its card, as a share of the card limit. */
  limitShare: number;
  verdict: Verdict;
}

/**
 * "E se eu comprar parcelado?" Applies the purchase as extra installments on top
 * of the baseline and compares the lowest projected balance with and without it.
 * Installments are equal parts; any rounding remainder goes into the first one.
 */
export function simulatePurchase(
  profile: Profile,
  scenario: PurchaseScenario,
  from: string,
  horizonMonths = 18,
): PurchaseResult {
  const base = cents(scenario.total / scenario.installments);
  const remainder = cents(scenario.total - base * scenario.installments);
  const added: Installment[] = Array.from({ length: scenario.installments }, (_, k) => ({
    cardId: scenario.cardId,
    dueMonth: addMonths(scenario.firstMonth, k),
    amount: k === 0 ? cents(base + remainder) : base,
  }));

  const withPurchase: Profile = {
    ...profile,
    installments: [...profile.installments, ...added],
  };

  const baselineLow = criticalDay(profile.balance, buildEvents(profile, from, horizonMonths))?.balance ?? profile.balance;
  const scenarioLow = criticalDay(withPurchase.balance, buildEvents(withPurchase, from, horizonMonths))?.balance ?? withPurchase.balance;

  const card = profile.cards.find((c) => c.id === scenario.cardId);
  const limitShare = card && card.limit > 0 ? scenario.total / card.limit : Infinity;

  return {
    monthlyInstallment: base,
    baselineLow,
    scenarioLow,
    limitShare,
    verdict: verdictFor(scenarioLow, profile.netIncome, limitShare),
  };
}

/** Semáforo: text-backed, derived from the lowest projected balance and limit use. */
export function verdictFor(scenarioLow: number, netIncome: number, limitShare: number): Verdict {
  if (scenarioLow < 0 || limitShare > 1) return 'risco';
  if (scenarioLow < netIncome * 0.1 || limitShare > 0.7) return 'aperta';
  if (scenarioLow < netIncome * 0.25 || limitShare > 0.4) return 'atencao';
  return 'confortavel';
}

export { monthOf };
