import { describe, expect, it } from 'vitest';
import { makeProfile } from '../../engine/testing';
import {
  accountFromDraft,
  cardDeletionImpact,
  cardFromDraft,
  bridgeFromDraft,
  debtFromDraft,
  entryFromDraft,
  goalFromDraft,
  installmentsFromGrid,
  MSG,
  type CardDraft,
  type EntryDraft,
} from './mappers';

const card: CardDraft = { id: 'c', bank: 'Nubank', name: '', closingDay: '5', dueDay: '12', limit: '8.000', variableEstimate: '800', availableInformed: '' };
const entry: EntryDraft = { id: 'e', kind: 'out', name: 'Aluguel', amount: '2.000', recurrence: 'monthly', day: '10', startMonth: '11/2026', endMonth: '', date: '' };

const noQuote = { payoffable: 'sim' as const, quoteKind: 'none' as const, payoffAmount: '', discountPct: '', quotedOn: '', installment: '' };

describe('form mappers', () => {
  it('builds a card, naming it after the bank when the name is empty', () => {
    expect(cardFromDraft(card)).toEqual({
      ok: true,
      value: { id: 'c', bank: 'Nubank', name: 'Nubank', closingDay: 5, dueDay: 12, limit: 8000, variableEstimate: 800, availableInformed: undefined },
    });
  });
  it('rejects equal closing and due days, a missing limit and an available limit above it', () => {
    const r = cardFromDraft({ ...card, dueDay: '5', limit: '', availableInformed: '10' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toMatchObject({ dueDay: MSG.sameDays, limit: MSG.required });
    const closing = cardFromDraft({ ...card, closingDay: '', dueDay: '5' });
    expect(closing.ok && closing.value.closingDay).toBe(29);
    const over = cardFromDraft({ ...card, availableInformed: '9.000' });
    expect(!over.ok && over.errors.availableInformed).toBe(MSG.overLimit);
  });
  it('builds a monthly entry with an inclusive end month', () => {
    const r = entryFromDraft({ ...entry, endMonth: '03/2027' });
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ amount: 2000, day: 10, startMonth: '2026-11', endMonth: '2027-03' }) });
  });
  it('builds a one-off entry from its date', () => {
    const r = entryFromDraft({ ...entry, recurrence: 'once', date: '20/12/2026' });
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ date: '2026-12-20', day: 20, startMonth: '2026-12' }) });
  });
  it('drops the card from an income and rejects an end before the start', () => {
    const income = entryFromDraft({ ...entry, kind: 'in', cardId: 'nu' });
    expect(income.ok && income.value.cardId).toBeUndefined();
    const bad = entryFromDraft({ ...entry, endMonth: '10/2026' });
    expect(!bad.ok && bad.errors.endMonth).toBe(MSG.endBeforeStart);
  });
  it('requires a positive amount', () => {
    const r = entryFromDraft({ ...entry, amount: '0' });
    expect(!r.ok && r.errors.amount).toBe(MSG.positive);
  });
  it('builds a debt with the rate as a fraction', () => {
    const r = debtFromDraft({ id: 'd', name: 'Carro', kind: 'financiamento', principal: '12.000', ratePct: '1,49', months: '24', system: 'price', startMonth: '12/2026', dueDay: '15', ...noQuote });
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ principal: 12000, monthlyRate: 0.0149, months: 24, startMonth: '2026-12' }) });
  });
  it('derives the monthly rate from the installment when the rate is blank', () => {
    const r = debtFromDraft({ id: 'd', name: 'Carro', kind: 'financiamento', principal: '12.000', ratePct: '', months: '24', system: 'price', startMonth: '12/2026', dueDay: '15', ...noQuote, installment: '598,39' });
    expect(r.ok && r.value.monthlyRate).toBeCloseTo(0.0149, 4);
    const low = debtFromDraft({ id: 'd', name: 'Carro', kind: 'financiamento', principal: '12.000', ratePct: '', months: '24', system: 'price', startMonth: '12/2026', dueDay: '15', ...noQuote, installment: '100' });
    expect(!low.ok && Object.keys(low.errors)).toEqual(['installment']);
    const neither = debtFromDraft({ id: 'd', name: 'Carro', kind: 'financiamento', principal: '12.000', ratePct: '', months: '24', system: 'price', startMonth: '12/2026', dueDay: '15', ...noQuote });
    expect(!neither.ok && Object.keys(neither.errors)).toEqual(['ratePct']);
  });
  it('reads a payoff quote (amount or discount, never both) and clears it when removed', () => {
    const base = { id: 'd', name: 'Carro', kind: 'financiamento' as const, principal: '12.000', ratePct: '1,49', months: '24', system: 'price' as const, startMonth: '12/2026', dueDay: '15' };
    const valor = debtFromDraft({ ...base, ...noQuote, quoteKind: 'valor', payoffAmount: '9.800,00', quotedOn: '04/11/2026' });
    expect(valor.ok && valor.value).toMatchObject({ payoffAmount: 9800, payoffDiscountAnnual: undefined, payoffQuotedOn: '2026-11-04' });
    const desc = debtFromDraft({ ...base, ...noQuote, quoteKind: 'desconto', discountPct: '5,5', payoffAmount: '9.800,00' });
    expect(desc.ok && desc.value).toMatchObject({ payoffDiscountAnnual: 0.055, payoffAmount: undefined });
    const none = debtFromDraft({ ...base, ...noQuote, payoffable: 'nao' });
    expect(none.ok && { ...{ payoffAmount: 1 }, ...none.value }).toMatchObject({ payoffAmount: undefined, payoffable: false });
    const bad = debtFromDraft({ ...base, ...noQuote, quoteKind: 'desconto', discountPct: '0', quotedOn: '31/02' });
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(['discountPct', 'quotedOn']);
  });
  it('reads a bridge: typed rate, true rate from net amount and installment, invoice split from premissas', () => {
    const base = { id: 'b', name: 'Banco', kind: 'emprestimo' as const, ratePct: '2,5', months: '12', source: '', effectiveFrom: '2026-11-04', netReceived: '', installment: '' };
    const typed = bridgeFromDraft(base, 0.09);
    expect(typed.ok && typed.value).toMatchObject({ monthlyRate: 0.025, source: 'informado por você' });
    const real = bridgeFromDraft({ ...base, ratePct: '', netReceived: '9.500', installment: '945,60' }, 0.09);
    expect(real.ok && real.value.monthlyRate).toBeGreaterThan(0.02);
    expect(bridgeFromDraft({ ...base, kind: 'parcelar_fatura', ratePct: '' }, 0.0934)).toMatchObject({ ok: true, value: { monthlyRate: 0.0934 } });
    const bad = bridgeFromDraft({ ...base, name: ' ', ratePct: '', months: '0' }, 0.09);
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(['months', 'name', 'ratePct']);
  });
  it('rejects impossible debt terms', () => {
    const r = debtFromDraft({ id: 'd', name: 'X', kind: 'emprestimo', principal: '1', ratePct: '150', months: '0', system: 'sac', startMonth: '1/2027', dueDay: '40', ...noQuote });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['dueDay', 'months', 'ratePct']);
  });
  it('turns the month grid into installments, skipping empty and zero months', () => {
    let n = 0;
    const r = installmentsFromGrid('nu', { '2026-12': '300', '2026-11': '1.200,50', '2027-01': '', '2027-02': '0' }, () => `i${n++}`);
    expect(r).toEqual({ ok: true, value: [
      { id: 'i0', cardId: 'nu', dueMonth: '2026-11', amount: 1200.5 },
      { id: 'i1', cardId: 'nu', dueMonth: '2026-12', amount: 300 },
    ] });
    const bad = installmentsFromGrid('nu', { '2026-11': 'x' }, () => 'i');
    expect(!bad.ok && bad.errors['2026-11']).toBe(MSG.money);
  });
  it('defaults an empty balance to zero', () => {
    expect(accountFromDraft({ id: 'a', bank: 'Itaú', kind: 'corrente', balance: '' })).toEqual({ ok: true, value: { id: 'a', bank: 'Itaú', kind: 'corrente', balance: 0 } });
  });
  it('builds a goal with its deadline at the end of the month', () => {
    const r = goalFromDraft({ id: 'g', name: 'Reserva', target: '18.000', saved: '2.500', deadline: '02/2027', priority: '1' });
    expect(r).toEqual({ ok: true, value: { id: 'g', name: 'Reserva', target: 18000, saved: 2500, deadline: '2027-02-28', priority: 1 } });
    const bad = goalFromDraft({ id: 'g', name: '', target: '0', saved: '', deadline: '13/2027', priority: '0' });
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(['deadline', 'name', 'priority', 'target']);
  });
  it('lists what goes with a deleted card', () => {
    const profile = makeProfile({
      entries: [{ id: 'net', kind: 'out', name: 'Streaming', amount: 50, day: 20, recurrence: 'monthly', startMonth: '2026-11', cardId: 'nu' }],
    });
    expect(cardDeletionImpact(profile, 'nu')).toEqual({ installments: 1, invoices: 0, entries: 1 });
  });
});
