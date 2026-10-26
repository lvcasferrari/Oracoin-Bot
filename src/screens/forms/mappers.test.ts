import { describe, expect, it } from 'vitest';
import { makeProfile } from '../../engine/testing';
import {
  accountFromDraft,
  cardDeletionImpact,
  cardFromDraft,
  debtFromDraft,
  entryFromDraft,
  installmentsFromGrid,
  MSG,
  type CardDraft,
  type EntryDraft,
} from './mappers';

const card: CardDraft = { id: 'c', bank: 'Nubank', name: '', closingDay: '5', dueDay: '12', limit: '8.000', variableEstimate: '800', availableInformed: '' };
const entry: EntryDraft = { id: 'e', kind: 'out', name: 'Aluguel', amount: '2.000', recurrence: 'monthly', day: '10', startMonth: '11/2026', endMonth: '', date: '' };

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
    const r = debtFromDraft({ id: 'd', name: 'Carro', kind: 'financiamento', principal: '12.000', ratePct: '1,49', months: '24', system: 'price', startMonth: '12/2026', dueDay: '15' });
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ principal: 12000, monthlyRate: 0.0149, months: 24, startMonth: '2026-12' }) });
  });
  it('rejects impossible debt terms', () => {
    const r = debtFromDraft({ id: 'd', name: 'X', kind: 'emprestimo', principal: '1', ratePct: '150', months: '0', system: 'sac', startMonth: '1/2027', dueDay: '40' });
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
  it('lists what goes with a deleted card', () => {
    const profile = makeProfile({
      entries: [{ id: 'net', kind: 'out', name: 'Streaming', amount: 50, day: 20, recurrence: 'monthly', startMonth: '2026-11', cardId: 'nu' }],
    });
    expect(cardDeletionImpact(profile, 'nu')).toEqual({ installments: 1, invoices: 0, entries: 1 });
  });
});
