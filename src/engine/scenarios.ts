import { addDays, addMonths, cents, dateInMonth, monthDiff, monthOf } from './dates';
import { invoiceMonthForCharge } from './cycle';
import { debtSchedule, debtSummary, priceSchedule, type DebtSummary } from './debt';
import { buildEvents, criticalDay, entryOccurrence, invoiceFor, profileBalance, projectedInvoice, type BalancePoint } from './events';
import { contributions, goalDelays, type GoalDelay } from './goals';
import { availableLimit, type LimitView } from './limit';
import { essentialOutflows, freeMargin, netIncome, referenceIncome } from './metrics';
import { param, paramRow } from './params';
import { worstCase, type WorstCase } from './rotativo';
import { splitInstallments, verdictFor, type Verdict } from './simulator';
import { monthlySummary, type MonthRow } from './summary';
import type { Bridge, Debt, Entry, Installment, Invoice, Parameter, ParamKey, Profile, Scenario, ScenarioChange } from './types';

export type MakeId = (prefix: string) => string;

/** Deterministic ids for previews; commits pass a real id generator. */
const sequence = (): MakeId => {
  let n = 0;
  return (prefix) => `scn-${prefix}-${n++}`;
};

/** First date a hypothetical event can take: events on or before the balance date are already in the balance. */
const firstFreeDate = (profile: Profile, today: string): string => {
  const next = addDays(profile.balanceDate, 1);
  return next > today ? next : today;
};

/** Splits a monthly entry so that `transform` applies only within the months [from, to]. */
function splitEntry(e: Entry, from: string, to: string, transform: (e: Entry) => Entry, makeId: MakeId): Entry[] {
  if (e.recurrence !== 'monthly' || e.startMonth > to || (e.endMonth !== undefined && e.endMonth < from)) return [e];
  const pieces: Entry[] = [];
  const startsBefore = e.startMonth < from;
  if (startsBefore) pieces.push({ ...e, endMonth: addMonths(from, -1) });
  const window = transform({ ...e, startMonth: startsBefore ? from : e.startMonth, endMonth: e.endMonth !== undefined && e.endMonth < to ? e.endMonth : to });
  pieces.push({ ...window, id: startsBefore ? makeId('entry') : e.id });
  if (e.endMonth === undefined || e.endMonth > to) pieces.push({ ...e, id: makeId('entry'), startMonth: addMonths(to, 1) });
  return pieces;
}

/**
 * Applies the changes of a scenario to a copy of the profile (spec 01: a scenario never has its
 * own data; it always starts from the repository).
 */
export function applyChanges(profile: Profile, changes: ScenarioChange[], today: string, makeId: MakeId = sequence()): Profile {
  let p: Profile = { ...profile, entries: [...profile.entries], installments: [...profile.installments], debts: [...profile.debts], invoices: [...profile.invoices] };
  const month = monthOf(today);
  const free = firstFreeDate(profile, today);

  for (const c of changes) {
    switch (c.type) {
      case 'purchase': {
        const card = p.cards.find((x) => x.id === c.cardId);
        if (!card) throw new Error(`Unknown card ${c.cardId}`);
        const parts = c.interestMonthly ? priceSchedule(c.total, c.interestMonthly, c.installments).map((r) => r.payment) : splitInstallments(c.total, c.installments);
        const first = invoiceMonthForCharge(card, c.date ?? today, p.parameters, today);
        p.installments.push(...parts.map((amount, k) => ({ id: makeId('inst'), cardId: card.id, dueMonth: addMonths(first, k), amount })));
        break;
      }
      case 'debt': {
        const financed = cents(c.debt.principal - c.downPayment);
        if (c.downPayment > 0) {
          p.entries.push({ id: makeId('entry'), kind: 'out', name: `Entrada: ${c.debt.name}`, amount: c.downPayment, day: Number(free.slice(8)), recurrence: 'once', startMonth: monthOf(free), date: free });
        }
        if (financed > 0) p.debts.push({ ...c.debt, id: makeId('debt'), principal: financed });
        if (c.incomeStressPct) {
          p = applyChanges(p, [{ type: 'incomeChange', deltaPct: -c.incomeStressPct, months: c.debt.months, startMonth: c.debt.startMonth }], today, makeId);
        }
        break;
      }
      case 'subscription': {
        // A day that already passed this month starts next month (no phantom charge in the past).
        const startMonth = dateInMonth(month, c.day) >= free ? month : addMonths(month, 1);
        p.entries.push({ id: makeId('entry'), kind: 'out', name: c.name ?? 'Nova assinatura', amount: c.amount, day: c.day, recurrence: 'monthly', startMonth, cardId: c.cardId });
        break;
      }
      case 'incomeChange': {
        const to = addMonths(c.startMonth, c.months - 1);
        if (c.deltaPct !== undefined) {
          const factor = 1 + c.deltaPct;
          p.entries = p.entries.flatMap((e) =>
            e.kind === 'in' ? splitEntry(e, c.startMonth, to, (x) => ({ ...x, amount: cents(Math.max(0, x.amount * factor)) }), makeId) : [e],
          );
        } else if (c.deltaAmount !== undefined) {
          const delta = c.deltaAmount;
          const main = p.entries
            .filter((e) => e.kind === 'in' && e.recurrence === 'monthly' && entryOccurrence(e, c.startMonth))
            .sort((a, b) => b.amount - a.amount)[0];
          if (main) {
            p.entries = p.entries.flatMap((e) => (e.id === main.id ? splitEntry(e, c.startMonth, to, (x) => ({ ...x, amount: cents(Math.max(0, x.amount + delta)) }), makeId) : [e]));
          } else if (delta > 0) {
            p.entries.push({ id: makeId('entry'), kind: 'in', name: 'Renda extra', amount: delta, day: 1, recurrence: 'monthly', startMonth: c.startMonth, endMonth: to });
          }
        }
        break;
      }
      case 'costChange':
        p.entries.push({ id: makeId('entry'), kind: 'out', name: c.name ?? 'Aumento de custo de vida', amount: c.amount, day: 1, recurrence: 'monthly', startMonth: c.startMonth, category: c.category });
        break;
      case 'emergency': {
        const date = c.date < free ? free : c.date;
        p.entries.push({ id: makeId('entry'), kind: 'out', name: 'Imprevisto', amount: c.amount, day: Number(date.slice(8)), recurrence: 'once', startMonth: monthOf(date), date });
        break;
      }
      case 'payoff': {
        const debt = p.debts.find((d) => d.id === c.debtId);
        if (!debt) throw new Error(`Unknown debt ${c.debtId}`);
        const date = monthOf(free) >= c.month ? free : dateInMonth(c.month, 1);
        p.debts = p.debts.map((d) => (d.id === debt.id ? { ...d, paidOffMonth: monthOf(date) } : d));
        p.entries.push({ id: makeId('entry'), kind: 'out', name: `Quitação: ${debt.name}`, amount: c.amount, day: Number(date.slice(8)), recurrence: 'once', startMonth: monthOf(date), date });
        break;
      }
      case 'payPartial': {
        const card = p.cards.find((x) => x.id === c.cardId);
        if (!card) throw new Error(`Unknown card ${c.cardId}`);
        const row = p.invoices.find((i) => i.cardId === c.cardId && i.dueMonth === c.dueMonth);
        const amount = row?.amount ?? projectedInvoice(p, card, c.dueMonth, today);
        const paid = Math.min(c.payNow, amount);
        const invoice: Invoice = {
          id: row?.id ?? makeId('inv'),
          cardId: card.id,
          dueMonth: c.dueMonth,
          amount,
          origin: row?.origin ?? 'confirmada',
          status: paid >= amount ? 'paga' : 'parcial',
          paidAmount: paid,
          partialPlanMonths: c.months,
          estimatedAtConfirm: row?.estimatedAtConfirm,
        };
        p.invoices = [...p.invoices.filter((i) => i !== row), invoice];
        break;
      }
    }
  }
  return addToEstimatedInvoices(profile, p, today);
}

/**
 * Covers each month whose lowest balance falls below `reserve` with the bridge (plano-de-quitacao §3.7):
 * a one-off "Crédito ponte" inflow plus a Price debt, or a split of that month's invoice.
 * At most one draw per month; the result is plain rows, so summary, critical day and commit just work.
 */
export function applyBridge(profile: Profile, bridge: Bridge, reserve: number, today: string, makeId: MakeId = sequence()): Profile {
  let p = profile;
  const done = new Set<string>();
  const free = firstFreeDate(profile, today);
  for (let k = 0; k < param(profile.parameters, 'projection_months', today); k++) {
    const row = monthlySummary(p, today).find((r) => r.lowBalance < reserve && !done.has(r.month));
    if (!row) break;
    done.add(row.month);
    const gap = cents(reserve - row.lowBalance);
    if (bridge.kind === 'parcelar_fatura') {
      // Covers at most the largest invoice of the month: pay what the gap leaves, split the rest.
      const invoices = p.cards.map((c) => ({ card: c, amount: invoiceFor(p, c, row.month, today).cashOut })).filter((x) => x.amount > 0);
      const top = invoices.sort((a, b) => b.amount - a.amount)[0];
      if (top) p = applyChanges(p, [{ type: 'payPartial', cardId: top.card.id, dueMonth: row.month, payNow: cents(Math.max(0, top.amount - gap)), months: bridge.months }], today, makeId);
      continue;
    }
    // The day before the month starts (or the first free day): same-day outflows sort first, so a draw on the 1st would come too late.
    const eve = addDays(dateInMonth(row.month, 1), -1);
    const date = free > eve ? free : eve;
    const ids = { entry: makeId('entry'), debt: makeId('debt') };
    p = {
      ...p,
      entries: [...p.entries, { id: ids.entry, kind: 'in', name: 'Crédito ponte', amount: gap, day: Number(date.slice(8)), recurrence: 'once', startMonth: monthOf(date), date }],
      debts: [
        ...p.debts,
        { id: ids.debt, name: `Crédito ponte (${bridge.name})`, kind: 'emprestimo', principal: gap, monthlyRate: bridge.monthlyRate, months: bridge.months, system: 'price', startMonth: addMonths(row.month, 1), dueDay: Number(date.slice(8)) },
      ],
    };
  }
  return p;
}

/**
 * A stored 'estimada' row is the user's guess of the whole invoice and hides the projection, so
 * charges a scenario adds to that card and month (installments, card entries) are added to it.
 */
function addToEstimatedInvoices(before: Profile, after: Profile, today: string): Profile {
  const invoices = after.invoices.map((row) => {
    if (row.origin !== 'estimada' || row.status !== 'fechada') return row;
    const card = after.cards.find((c) => c.id === row.cardId);
    if (!card) return row;
    const delta = cents(projectedInvoice(after, card, row.dueMonth, today) - projectedInvoice(before, card, row.dueMonth, today));
    return delta === 0 ? row : { ...row, amount: cents(row.amount + delta) };
  });
  return { ...after, invoices };
}

export interface LimitImpact {
  cardId: string;
  label: string;
  before: LimitView;
  after: LimitView;
}

export interface ScenarioExtras {
  purchase?: { firstMonth: string; monthlyInstallment: number; installments: number };
  subscription?: { monthly: number; shareOfMargin: number | null };
  incomeChange?: { firstNegativeMonth: string | null; cushionMonths: number | null };
  emergency?: { reserveMonths: number | null };
  debt?: DebtSummary & { incomeShare: number | null; months: number };
  payPartial?: WorstCase;
}

export interface ScenarioResult {
  verdict: Verdict;
  /** The profile with the changes applied. */
  after: Profile;
  baseline: { monthly: MonthRow[]; critical: BalancePoint | null };
  result: { monthly: MonthRow[]; critical: BalancePoint | null };
  limitImpact: LimitImpact[];
  /** Change in what the months can put toward goals over the horizon (negative = less). */
  savingsImpact: number;
  goalDelays: GoalDelay[];
  extras: ScenarioExtras;
  /** Range of the scenario's lowest balance with the card variable spend ± the uncertainty parameter. */
  uncertainty: { low: number; high: number };
  assumptions: Parameter[];
}

const VERDICT_KEYS: ParamKey[] = ['verdict_tight_income_share', 'verdict_attention_income_share', 'verdict_limit_tight', 'verdict_limit_attention', 'variable_estimate_uncertainty'];

/** "E se…?" result in spec 04 order: verdict, cash timeline, limit and savings, goals, then assumptions. */
export function evaluate(profile: Profile, scenario: Scenario, today: string): ScenarioResult {
  const after = applyChanges(profile, scenario.changes, today);
  const start = profileBalance(profile);
  const month = monthOf(today);
  const criticalBefore = criticalDay(start, buildEvents(profile, today));
  const criticalAfter = criticalDay(start, buildEvents(after, today));
  const scenarioLow = criticalAfter?.balance ?? start;
  const income = netIncome(profile, month, today);

  const purchaseShares = scenario.changes.flatMap((c) => {
    if (c.type !== 'purchase') return [];
    const card = profile.cards.find((x) => x.id === c.cardId);
    return [card && card.limit > 0 ? c.total / card.limit : Infinity];
  });
  const limitShare = purchaseShares.length ? Math.max(...purchaseShares) : 0;
  const verdict = verdictFor(scenarioLow, referenceIncome(profile, today), limitShare, profile.parameters, today);

  const newInstallments = after.installments.filter((i) => !profile.installments.some((b) => b.id === i.id));
  const limitImpact = profile.cards
    .map((card) => {
      const before = availableLimit(profile, card, today);
      const added = cents(newInstallments.filter((i) => i.cardId === card.id).reduce((s, i) => s + i.amount, 0));
      const changedCard = after.cards.find((c) => c.id === card.id) ?? card;
      const afterView = before.estimated ? availableLimit(after, changedCard, today) : { value: cents(before.value - added), estimated: true };
      return { cardId: card.id, label: `${card.bank} ${card.name}`.trim(), before, after: afterView };
    })
    .filter((x) => x.before.value !== x.after.value);

  const totalContributions = (p: Profile) => contributions(p, today).reduce((s, c) => s + c.amount, 0);
  const savingsImpact = cents(totalContributions(after) - totalContributions(profile));

  const u = param(profile.parameters, 'variable_estimate_uncertainty', today);
  const scaled = (k: number): Profile => ({ ...after, cards: after.cards.map((c) => ({ ...c, variableEstimate: cents(c.variableEstimate * k) })) });
  const low = criticalDay(start, buildEvents(scaled(1 + u), today))?.balance ?? start;
  const high = criticalDay(start, buildEvents(scaled(1 - u), today))?.balance ?? start;

  const monthlyAfter = monthlySummary(after, today);
  const extras: ScenarioExtras = {};
  const assumptions = VERDICT_KEYS.map((k) => paramRow(profile.parameters, k, today));

  for (const c of scenario.changes) {
    if (c.type === 'purchase' && !extras.purchase) {
      const added = newInstallments.filter((i) => i.cardId === c.cardId).sort((a, b) => (a.dueMonth < b.dueMonth ? -1 : 1));
      if (added.length) extras.purchase = { firstMonth: added[0].dueMonth, monthlyInstallment: added[added.length - 1].amount, installments: added.length };
    }
    if (c.type === 'subscription' && !extras.subscription) {
      const margin = freeMargin(profile, month, today);
      extras.subscription = { monthly: c.amount, shareOfMargin: margin > 0 ? c.amount / margin : null };
    }
    if (c.type === 'incomeChange' && !extras.incomeChange) {
      const firstNegative = monthlyAfter.find((r) => r.month >= c.startMonth && r.lowBalance < 0)?.month ?? null;
      extras.incomeChange = { firstNegativeMonth: firstNegative, cushionMonths: firstNegative ? monthDiff(c.startMonth, firstNegative) : null };
    }
    if (c.type === 'emergency' && !extras.emergency) {
      const essentials = essentialOutflows(profile, month, today);
      extras.emergency = { reserveMonths: essentials > 0 ? Math.max(0, start - c.amount) / essentials : null };
    }
    if (c.type === 'debt' && !extras.debt) {
      const added = after.debts.find((d) => !profile.debts.some((b) => b.id === d.id));
      if (added) {
        const summary = debtSummary(debtSchedule(added));
        extras.debt = { ...summary, months: added.months, incomeShare: income > 0 ? summary.firstPayment / income : null };
      }
    }
    if (c.type === 'payPartial' && !extras.payPartial) {
      const inv = after.invoices.find((i) => i.cardId === c.cardId && i.dueMonth === c.dueMonth);
      if (inv && inv.status === 'parcial') {
        extras.payPartial = worstCase(cents(inv.amount - (inv.paidAmount ?? 0)), c.months, profile.parameters, today);
        assumptions.push(...extras.payPartial.assumptions);
      }
    }
  }

  return {
    verdict,
    after,
    baseline: { monthly: monthlySummary(profile, today), critical: criticalBefore },
    result: { monthly: monthlyAfter, critical: criticalAfter },
    limitImpact,
    savingsImpact,
    goalDelays: goalDelays(profile, after, today),
    extras,
    uncertainty: { low, high },
    assumptions,
  };
}

export interface ScenarioRows {
  entries: Entry[];
  installments: Installment[];
  debts: Debt[];
  invoices: Invoice[];
}

/** Exactly the rows a scenario adds or changes: what "Seguir com isso" writes. */
export function scenarioRows(before: Profile, after: Profile): ScenarioRows {
  const changed = <T extends { id: string }>(a: T[], b: T[]): T[] =>
    b.filter((x) => {
      const old = a.find((y) => y.id === x.id);
      return !old || JSON.stringify(old) !== JSON.stringify(x);
    });
  return {
    entries: changed(before.entries, after.entries),
    installments: changed(before.installments, after.installments),
    debts: changed(before.debts, after.debts),
    invoices: changed(before.invoices, after.invoices),
  };
}
