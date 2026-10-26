// Pure: form text → engine entities, with calm pt-BR messages. No react-native imports (tested in Vitest).
import { dateInMonth, monthOf, type Account, type Card, type Category, type Debt, type Entry, type Goal, type Installment, type Profile } from '../../engine';
import { parseDateBR, parseDay, parseMonthBR } from '../../lib/dateInput';
import { parseBRL } from '../../lib/money';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export const MSG = {
  required: 'Preencha este campo.',
  money: 'Valor inválido. Exemplo: 1.234,56',
  positive: 'Informe um valor maior que zero.',
  day: 'Use um dia de 1 a 31.',
  month: 'Use mês/ano. Exemplo: 11/2026',
  date: 'Use dia/mês/ano. Exemplo: 05/11/2026',
  sameDays: 'O vencimento precisa ser diferente do fechamento.',
  overLimit: 'Não pode ser maior que o limite.',
  endBeforeStart: 'O fim vem antes do início.',
  months: 'Use um número de 1 a 600.',
  rate: 'Use uma taxa entre 0 e 100% ao mês.',
} as const;

const done = <T>(errors: Record<string, string>, value: () => T): Result<T> =>
  Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: value() };

function money(errors: Record<string, string>, field: string, text: string, opts: { required?: boolean; positive?: boolean } = {}): number | undefined {
  if (text.trim() === '') {
    if (opts.required) errors[field] = MSG.required;
    return undefined;
  }
  const value = parseBRL(text);
  if (value === null) errors[field] = MSG.money;
  else if (opts.positive && value <= 0) errors[field] = MSG.positive;
  return value ?? undefined;
}

function day(errors: Record<string, string>, field: string, text: string): number | undefined {
  const value = parseDay(text);
  if (value === null) errors[field] = MSG.day;
  return value ?? undefined;
}

export interface AccountDraft { id: string; bank: string; kind: Account['kind']; balance: string }

export function accountFromDraft(d: AccountDraft): Result<Account> {
  const errors: Record<string, string> = {};
  if (!d.bank.trim()) errors.bank = MSG.required;
  const balance = money(errors, 'balance', d.balance) ?? 0;
  return done(errors, () => ({ id: d.id, bank: d.bank.trim(), kind: d.kind, balance }));
}

export interface CardDraft {
  id: string; bank: string; name: string; closingDay: string; dueDay: string; limit: string;
  variableEstimate: string; availableInformed: string;
}

export function cardFromDraft(d: CardDraft): Result<Card> {
  const errors: Record<string, string> = {};
  if (!d.bank.trim()) errors.bank = MSG.required;
  const closingDay = day(errors, 'closingDay', d.closingDay);
  const dueDay = day(errors, 'dueDay', d.dueDay);
  if (closingDay !== undefined && closingDay === dueDay) errors.dueDay = MSG.sameDays;
  const limit = money(errors, 'limit', d.limit, { required: true, positive: true });
  const variableEstimate = money(errors, 'variableEstimate', d.variableEstimate) ?? 0;
  const availableInformed = money(errors, 'availableInformed', d.availableInformed);
  if (availableInformed !== undefined && limit !== undefined && availableInformed > limit) errors.availableInformed = MSG.overLimit;
  return done(errors, () => ({
    id: d.id,
    bank: d.bank.trim(),
    name: d.name.trim() || d.bank.trim(),
    closingDay: closingDay as number,
    dueDay: dueDay as number,
    limit: limit as number,
    variableEstimate,
    availableInformed,
  }));
}

export interface EntryDraft {
  id: string; kind: Entry['kind']; name: string; amount: string; recurrence: Entry['recurrence'];
  day: string; startMonth: string; endMonth: string; date: string; cardId?: string; category?: Category; accountId?: string;
}

export function entryFromDraft(d: EntryDraft): Result<Entry> {
  const errors: Record<string, string> = {};
  if (!d.name.trim()) errors.name = MSG.required;
  const amount = money(errors, 'amount', d.amount, { required: true, positive: true });
  const cardId = d.kind === 'out' ? d.cardId : undefined;
  const base = { id: d.id, kind: d.kind, name: d.name.trim(), recurrence: d.recurrence, cardId, category: d.category, accountId: d.accountId };

  if (d.recurrence === 'once') {
    const date = parseDateBR(d.date);
    if (!date) errors.date = MSG.date;
    return done(errors, () => ({ ...base, amount: amount as number, date: date as string, day: Number((date as string).slice(8)), startMonth: monthOf(date as string) }));
  }

  const dayValue = day(errors, 'day', d.day);
  const startMonth = parseMonthBR(d.startMonth);
  if (!startMonth) errors.startMonth = MSG.month;
  let endMonth: string | undefined;
  if (d.endMonth.trim()) {
    endMonth = parseMonthBR(d.endMonth) ?? undefined;
    if (!endMonth) errors.endMonth = MSG.month;
    else if (startMonth && endMonth < startMonth) errors.endMonth = MSG.endBeforeStart;
  }
  return done(errors, () => ({ ...base, amount: amount as number, day: dayValue as number, startMonth: startMonth as string, endMonth }));
}

export interface DebtDraft {
  id: string; name: string; kind: Debt['kind']; principal: string; ratePct: string; months: string;
  system: Debt['system']; startMonth: string; dueDay: string;
}

export function debtFromDraft(d: DebtDraft): Result<Debt> {
  const errors: Record<string, string> = {};
  if (!d.name.trim()) errors.name = MSG.required;
  const principal = money(errors, 'principal', d.principal, { required: true, positive: true });
  const ratePct = d.ratePct.trim() === '' ? null : parseBRL(d.ratePct);
  if (ratePct === null || ratePct > 100) errors.ratePct = MSG.rate;
  const months = /^\s*\d+\s*$/.test(d.months) ? Number(d.months) : NaN;
  if (!(months >= 1 && months <= 600)) errors.months = MSG.months;
  const startMonth = parseMonthBR(d.startMonth);
  if (!startMonth) errors.startMonth = MSG.month;
  const dueDay = day(errors, 'dueDay', d.dueDay);
  return done(errors, () => ({
    id: d.id,
    name: d.name.trim(),
    kind: d.kind,
    principal: principal as number,
    monthlyRate: (ratePct as number) / 100,
    months,
    system: d.system,
    startMonth: startMonth as string,
    dueDay: dueDay as number,
  }));
}

/** The installments month grid: one optional amount per month; empty or zero months are skipped. */
export function installmentsFromGrid(cardId: string, values: Record<string, string>, makeId: () => string): Result<Installment[]> {
  const errors: Record<string, string> = {};
  const rows: Installment[] = [];
  for (const [month, text] of Object.entries(values).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const amount = money(errors, month, text);
    if (amount) rows.push({ id: makeId(), cardId, dueMonth: month, amount });
  }
  return done(errors, () => rows);
}

export interface GoalDraft { id: string; name: string; target: string; saved: string; deadline: string; priority: string }

/** A goal; the deadline is a month ("12/2027") stored as that month's last day. */
export function goalFromDraft(d: GoalDraft): Result<Goal> {
  const errors: Record<string, string> = {};
  if (!d.name.trim()) errors.name = MSG.required;
  const target = money(errors, 'target', d.target, { required: true, positive: true });
  const saved = money(errors, 'saved', d.saved) ?? 0;
  let deadline: string | undefined;
  if (d.deadline.trim()) {
    const month = parseMonthBR(d.deadline);
    if (!month) errors.deadline = MSG.month;
    else deadline = dateInMonth(month, 31);
  }
  const priority = /^\s*\d+\s*$/.test(d.priority) ? Number(d.priority) : NaN;
  if (!(priority >= 1 && priority <= 99)) errors.priority = 'Use um número de 1 a 99 (1 = mais importante).';
  return done(errors, () => ({ id: d.id, name: d.name.trim(), target: target as number, saved, deadline, priority }));
}

/** What goes with a card when it is deleted (shown before confirming). */
export function cardDeletionImpact(profile: Profile, cardId: string) {
  return {
    installments: profile.installments.filter((i) => i.cardId === cardId).length,
    invoices: profile.invoices.filter((i) => i.cardId === cardId).length,
    entries: profile.entries.filter((e) => e.cardId === cardId).length,
  };
}
