// Strategy finder (plano-de-quitacao §4): combines payoffs, a bridge and the variable spend, ranks by monthly cost.
import { cents, monthOf } from './dates';
import { debtSchedule, debtSummary } from './debt';
import { essentialOutflows } from './metrics';
import { param } from './params';
import { classifyDebt, payoffReturn, type DebtReading } from './quitacao';
import { worstCase } from './rotativo';
import { applyBridge, applyChanges, type MakeId } from './scenarios';
import { monthlyCost, monthlySummary, type MonthRow } from './summary';
import type { Bridge, Debt, Profile, ScenarioChange } from './types';

export type StrategyCriterion = 'custo_medio' | 'custo_fim' | 'menos_credito';

export interface Strategy {
  /** Debts paid off now, with the amount used. */
  payoffs: { debt: Debt; amount: number }[];
  bridge: Bridge | null;
  reducedVariable: boolean;
  /** Changes to replay with applyChanges (the bridge is applied after them). */
  changes: ScenarioChange[];
  after: Profile;
  rows: MonthRow[];
  avgMonthlyCost: number;
  endMonthlyCost: number;
  /** Bridge draws plus the unpaid part of split invoices. */
  newCredit: number;
  /** Interest of the new credit (worst case for split invoices). */
  newInterest: number;
  lowestBalance: number;
  /** False when the balance still falls below the reserve in a coming month (no bridge, or it could not cover). */
  covered: boolean;
}

export interface StrategyOptions {
  criterion?: StrategyCriterion;
  /** How much the "reduced" variable-spend lever cuts the cards' estimate. */
  variableCut?: number;
  top?: number;
}

const MAX_LEVERS = 4;
const MAX_BRIDGES = 3;

/** Every subset of `xs` (2^n, n ≤ MAX_LEVERS). */
const subsets = <T>(xs: T[]): T[][] => xs.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Minimum cash the bridge keeps: reserva_minima_months × this month's essential outflows. */
export const strategyReserve = (profile: Profile, today: string): number =>
  cents(param(profile.parameters, 'reserva_minima_months', today) * essentialOutflows(profile, monthOf(today), today));

const quoteOf = (debt: Debt) => ({ amount: debt.payoffAmount, discountAnnual: debt.payoffDiscountAnnual });

type Plan = Pick<Strategy, 'payoffs' | 'reducedVariable' | 'bridge'>;

/** The profile after a plan, before any bridge, plus the payoff changes. */
function base(profile: Profile, plan: Plan, today: string, makeId: MakeId, variableCut: number) {
  const changes: ScenarioChange[] = plan.payoffs.map((x) => ({ type: 'payoff', debtId: x.debt.id, month: monthOf(today), amount: x.amount }));
  let p = applyChanges(profile, changes, today, makeId);
  if (plan.reducedVariable) p = { ...p, cards: p.cards.map((c) => ({ ...c, variableEstimate: cents(c.variableEstimate * (1 - variableCut)) })) };
  return { p, changes };
}

/** Rebuilds a chosen strategy with real ids, for "Seguir com isso" (the ranking uses throwaway ids). */
export function realizeStrategy(profile: Profile, plan: Plan, today: string, makeId: MakeId, variableCut = 0.1): Profile {
  const { p } = base(profile, plan, today, makeId, variableCut);
  return plan.bridge ? applyBridge(p, plan.bridge, strategyReserve(profile, today), today, makeId) : p;
}

export function exploreStrategies(profile: Profile, bridges: Bridge[], today: string, opts: StrategyOptions = {}): Strategy[] {
  const { criterion = 'custo_medio', variableCut = 0.1, top = 5 } = opts;
  const month = monthOf(today);
  const reserve = strategyReserve(profile, today);
  // The most expensive payoffable debts are the levers.
  const levers = profile.debts
    .filter((d) => d.payoffable !== false && d.paidOffMonth === undefined)
    .sort((a, b) => b.monthlyRate - a.monthlyRate)
    .slice(0, MAX_LEVERS)
    .map((debt) => ({ debt, amount: payoffReturn(debt, quoteOf(debt), month, today).payoffAmount }));
  const options = bridges.slice(0, MAX_BRIDGES);

  const all: Strategy[] = [];
  for (const payoffs of subsets(levers)) {
    for (const reducedVariable of [false, true]) {
      let n = 0;
      const makeId: MakeId = (prefix) => `${prefix}-s${++n}`;
      const { p, changes } = base(profile, { payoffs, reducedVariable, bridge: null }, today, makeId, variableCut);
      const short = monthlySummary(p, today).some((r) => r.lowBalance < reserve);
      // Without a shortfall every bridge gives the same result: evaluate once.
      for (const bridge of short && options.length ? options : [null]) {
        const after = bridge ? applyBridge(p, bridge, reserve, today, makeId) : p;
        all.push(measure(profile, after, { payoffs, bridge, reducedVariable, changes }, reserve, today));
      }
    }
  }
  return rank(all, criterion).slice(0, top);
}

export interface DebtView {
  debt: Debt;
  /** Null when the contract does not allow early payoff. */
  payoffAmount: number | null;
  monthlyReturn: number | null;
  reading: DebtReading | null;
  /** Instalments a payoff now would avoid, summed. */
  avoidedTotal: number;
  quoted: boolean;
}

/** The Quitação table: what paying off each debt now returns and its neutral reading (§3.5). */
export function debtViews(profile: Profile, bridges: Bridge[], today: string): DebtView[] {
  const month = monthOf(today);
  const rows = monthlySummary(profile, today);
  const slack = Math.min(...rows.map((r) => r.lowBalance)) - strategyReserve(profile, today);
  const informed = bridges.filter((b) => b.kind !== 'meta').map((b) => b.monthlyRate);
  const bridgeRate = informed.length ? Math.min(...informed) : undefined;
  const cashYield = param(profile.parameters, 'rendimento_caixa_mensal', today);
  return profile.debts
    .filter((d) => d.paidOffMonth === undefined)
    .map((debt) => {
      const r = payoffReturn(debt, quoteOf(debt), month, today);
      const quoted = debt.payoffAmount !== undefined || debt.payoffDiscountAnnual !== undefined;
      const avoidedTotal = cents(r.avoided.reduce((s, x) => s + x, 0));
      if (debt.payoffable === false) return { debt, payoffAmount: null, monthlyReturn: null, reading: null, avoidedTotal, quoted };
      return { debt, payoffAmount: r.payoffAmount, monthlyReturn: r.monthlyReturn, reading: classifyDebt(r.monthlyReturn, { cashYield, bridgeRate, slack, payoffAmount: r.payoffAmount }), avoidedTotal, quoted };
    })
    .sort((a, b) => (b.monthlyReturn ?? -1) - (a.monthlyReturn ?? -1));
}

function measure(profile: Profile, after: Profile, s: Pick<Strategy, 'payoffs' | 'bridge' | 'reducedVariable' | 'changes'>, reserve: number, today: string): Strategy {
  const rows = monthlySummary(after, today);
  const costs = rows.map(monthlyCost);
  const newDebts = after.debts.filter((d) => !profile.debts.some((b) => b.id === d.id));
  const splits = after.invoices
    .filter((i) => i.status === 'parcial' && !profile.invoices.some((b) => b.id === i.id && b.status === 'parcial'))
    .map((i) => worstCase(cents(i.amount - (i.paidAmount ?? 0)), i.partialPlanMonths ?? 1, profile.parameters, today));
  const lowest = Math.min(...rows.map((r) => r.lowBalance));
  // This month's points before the first possible draw are already committed; no strategy can change them.
  const ahead = rows.slice(1).map((r) => r.lowBalance);
  return {
    ...s,
    after,
    rows,
    avgMonthlyCost: cents(mean(costs)),
    endMonthlyCost: costs.at(-1) ?? 0,
    newCredit: cents(newDebts.reduce((t, d) => t + d.principal, 0) + splits.reduce((t, w) => t + w.unpaid, 0)),
    newInterest: cents(newDebts.reduce((t, d) => t + debtSummary(debtSchedule(d)).totalInterest, 0) + splits.reduce((t, w) => t + w.totalCharges, 0)),
    lowestBalance: lowest,
    covered: Math.min(...ahead) >= reserve - 0.005,
  };
}

const KEY: Record<StrategyCriterion, (s: Strategy) => number> = {
  custo_medio: (s) => s.avgMonthlyCost,
  custo_fim: (s) => s.endMonthlyCost,
  menos_credito: (s) => s.newCredit,
};

/**
 * Covered strategies first, then the criterion, then the average cost; on a tie, the one that needs no spending cut.
 * A target ("meta") rate never ranks first.
 */
export function rank(strategies: Strategy[], criterion: StrategyCriterion): Strategy[] {
  const key = KEY[criterion];
  const sorted = [...strategies].sort(
    (a, b) => Number(b.covered) - Number(a.covered) || key(a) - key(b) || a.avgMonthlyCost - b.avgMonthlyCost || a.newInterest - b.newInterest || Number(a.reducedVariable) - Number(b.reducedVariable),
  );
  const first = sorted.findIndex((s) => s.bridge?.kind !== 'meta');
  if (first > 0) sorted.unshift(...sorted.splice(first, 1));
  return sorted;
}
