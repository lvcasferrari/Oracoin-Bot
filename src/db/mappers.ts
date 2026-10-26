// Money is INTEGER cents in SQLite and reais in the engine; this is the only place that converts.
// Exception: scenarios.changes_json keeps the engine's reais, because it is only read back by the engine.
import type { Account, Card, Debt, Entry, Goal, Installment, Invoice, Parameter, Scenario } from '../engine';
import type { SqlParam } from './driver';

export function toCents(reais: number): number {
  if (!Number.isFinite(reais) || Math.abs(reais) > 1e9) throw new RangeError(`Invalid amount: ${reais}`);
  return Math.round(reais * 100);
}

export const fromCents = (value: number): number => value / 100;

const centsOrNull = (reais: number | undefined): number | null => (reais === undefined ? null : toCents(reais));
const fromCentsOpt = (value: number | null): number | undefined => (value === null ? undefined : fromCents(value));
const opt = <T>(value: T | null): T | undefined => (value === null ? undefined : value);
const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

export interface AccountRow { id: string; bank: string; kind: Account['kind']; balance_cents: number }
export const accountFromRow = (r: AccountRow): Account => ({ id: r.id, bank: r.bank, kind: r.kind, balance: fromCents(r.balance_cents) });
export const accountToParams = (a: Account): SqlParam[] => [a.id, a.bank, a.kind, toCents(a.balance)];

export interface CardRow {
  id: string; bank: string; name: string; closing_day: number; due_day: number; limit_cents: number;
  variable_estimate_cents: number; available_informed_cents: number | null;
}
export const cardFromRow = (r: CardRow): Card => ({
  id: r.id, bank: r.bank, name: r.name, closingDay: r.closing_day, dueDay: r.due_day, limit: fromCents(r.limit_cents),
  variableEstimate: fromCents(r.variable_estimate_cents), availableInformed: fromCentsOpt(r.available_informed_cents),
});
export const cardToParams = (c: Card): SqlParam[] => [
  c.id, c.bank, c.name, c.closingDay, c.dueDay, toCents(c.limit), toCents(c.variableEstimate), centsOrNull(c.availableInformed),
];

export interface EntryRow {
  id: string; kind: Entry['kind']; name: string; amount_cents: number; day: number; recurrence: Entry['recurrence'];
  start_month: string; end_month: string | null; date: string | null; account_id: string | null; card_id: string | null;
  category: Entry['category'] | null;
}
export const entryFromRow = (r: EntryRow): Entry => ({
  id: r.id, kind: r.kind, name: r.name, amount: fromCents(r.amount_cents), day: r.day, recurrence: r.recurrence,
  startMonth: r.start_month, endMonth: opt(r.end_month), date: opt(r.date), accountId: opt(r.account_id),
  cardId: opt(r.card_id), category: opt(r.category),
});
export const entryToParams = (e: Entry): SqlParam[] => [
  e.id, e.kind, e.name, toCents(e.amount), e.day, e.recurrence, e.startMonth, orNull(e.endMonth), orNull(e.date),
  orNull(e.accountId), orNull(e.cardId), orNull(e.category),
];

export interface InstallmentRow { id: string; card_id: string; due_month: string; amount_cents: number }
export const installmentFromRow = (r: InstallmentRow): Installment => ({ id: r.id, cardId: r.card_id, dueMonth: r.due_month, amount: fromCents(r.amount_cents) });
export const installmentToParams = (i: Installment): SqlParam[] => [i.id, i.cardId, i.dueMonth, toCents(i.amount)];

export interface InvoiceRow {
  id: string; card_id: string; due_month: string; amount_cents: number; origin: Invoice['origin']; status: Invoice['status'];
  paid_cents: number | null; partial_plan_months: number | null; estimated_cents_at_confirm: number | null;
}
export const invoiceFromRow = (r: InvoiceRow): Invoice => ({
  id: r.id, cardId: r.card_id, dueMonth: r.due_month, amount: fromCents(r.amount_cents), origin: r.origin, status: r.status,
  paidAmount: fromCentsOpt(r.paid_cents), partialPlanMonths: opt(r.partial_plan_months),
  estimatedAtConfirm: fromCentsOpt(r.estimated_cents_at_confirm),
});
export const invoiceToParams = (i: Invoice): SqlParam[] => [
  i.id, i.cardId, i.dueMonth, toCents(i.amount), i.origin, i.status, centsOrNull(i.paidAmount), orNull(i.partialPlanMonths),
  centsOrNull(i.estimatedAtConfirm),
];

export interface DebtRow {
  id: string; name: string; kind: Debt['kind']; principal_cents: number; monthly_rate: number; months: number;
  system: Debt['system']; start_month: string; due_day: number;
}
export const debtFromRow = (r: DebtRow): Debt => ({
  id: r.id, name: r.name, kind: r.kind, principal: fromCents(r.principal_cents), monthlyRate: r.monthly_rate, months: r.months,
  system: r.system, startMonth: r.start_month, dueDay: r.due_day,
});
export const debtToParams = (d: Debt): SqlParam[] => {
  if (!Number.isFinite(d.monthlyRate) || d.monthlyRate < 0) throw new RangeError(`Invalid rate: ${d.monthlyRate}`);
  return [d.id, d.name, d.kind, toCents(d.principal), d.monthlyRate, d.months, d.system, d.startMonth, d.dueDay];
};

export interface GoalRow { id: string; name: string; target_cents: number; saved_cents: number; deadline: string | null; priority: number }
export const goalFromRow = (r: GoalRow): Goal => ({
  id: r.id, name: r.name, target: fromCents(r.target_cents), saved: fromCents(r.saved_cents), deadline: opt(r.deadline), priority: r.priority,
});
export const goalToParams = (g: Goal): SqlParam[] => [g.id, g.name, toCents(g.target), toCents(g.saved), orNull(g.deadline), g.priority];

export interface ParameterRow { key: Parameter['key']; effective_from: string; value: number; source: string; note: string | null }
export const parameterFromRow = (r: ParameterRow): Parameter => ({ key: r.key, effectiveFrom: r.effective_from, value: r.value, source: r.source, note: opt(r.note) });
export const parameterToParams = (p: Parameter): SqlParam[] => {
  if (!Number.isFinite(p.value)) throw new RangeError(`Invalid parameter value: ${p.value}`);
  return [p.key, p.effectiveFrom, p.value, p.source, orNull(p.note)];
};

export interface ScenarioRow { id: string; name: string; changes_json: string }
export const scenarioFromRow = (r: ScenarioRow): Scenario => ({ id: r.id, name: r.name, changes: JSON.parse(r.changes_json) });
export const scenarioToParams = (s: Scenario): SqlParam[] => [s.id, s.name, JSON.stringify(s.changes)];
