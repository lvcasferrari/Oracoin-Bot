import { describe, expect, it } from 'vitest';
import { cents } from './dates';
import { buildEvents, cashProjection, criticalDay, invoiceFor, profileBalance } from './events';
import { worstCase } from './rotativo';
import { makeProfile, nubank, TODAY } from './testing';
import type { Invoice } from './types';

const row = (overrides: Partial<Invoice>): Invoice => ({
  id: 'inv',
  cardId: 'nu',
  dueMonth: '2026-11',
  amount: 2500,
  origin: 'confirmada',
  status: 'fechada',
  ...overrides,
});

const invoiceEvent = (events: ReturnType<typeof buildEvents>, date: string) =>
  events.find((e) => e.source === 'invoice' && e.date === date);

describe('invoices in the cash flow', () => {
  it('pays the projected invoice on the due day, marked estimated', () => {
    const e = invoiceEvent(buildEvents(makeProfile(), TODAY), '2026-11-12');
    expect(e?.amount).toBe(-2000);
    expect(e?.estimated).toBe(true);
  });
  it('uses a confirmed invoice instead of the projection', () => {
    const e = invoiceEvent(buildEvents(makeProfile({ invoices: [row({})] }), TODAY), '2026-11-12');
    expect(e?.amount).toBe(-2500);
    expect(e?.estimated).toBe(false);
  });
  it('keeps a user-typed estimate marked as estimated', () => {
    const e = invoiceEvent(buildEvents(makeProfile({ invoices: [row({ origin: 'estimada' })] }), TODAY), '2026-11-12');
    expect(e?.amount).toBe(-2500);
    expect(e?.estimated).toBe(true);
  });
  it('still counts a paid invoice as an outflow until the balance is updated', () => {
    const e = invoiceEvent(buildEvents(makeProfile({ invoices: [row({ status: 'paga' })] }), TODAY), '2026-11-12');
    expect(e?.amount).toBe(-2500);
  });
  it('pays only the paid part of a partial invoice and brings the rest back as the worst-case plan', () => {
    const profile = makeProfile({ invoices: [row({ amount: 2000, status: 'parcial', paidAmount: 500 })] });
    const today = '2026-11-20'; // the partial due date is already past, but after the balance date
    const events = buildEvents(profile, today);
    const plan = worstCase(1500, 12, profile.parameters, today);
    expect(invoiceEvent(events, '2026-11-12')?.amount).toBe(-500);
    expect(invoiceFor(profile, nubank, '2026-12', today).total).toBe(cents(800 + plan.payments[0]));
    expect(invoiceEvent(events, '2026-12-12')?.amount).toBe(-cents(800 + plan.payments[0]));
  });
});

describe('entries in the cash flow', () => {
  it('excludes events on the balance date (already in the balance)', () => {
    const events = buildEvents(makeProfile({ balanceDate: '2026-11-05' }), '2026-11-05');
    const salaries = events.filter((e) => e.refId === 'sal');
    expect(salaries[0].date).toBe('2026-12-05');
  });
  it('places a yearly entry once a year', () => {
    const profile = makeProfile({
      entries: [{ id: 'ipva', kind: 'out', name: 'IPVA', amount: 1200, day: 15, recurrence: 'yearly', startMonth: '2026-02' }],
    });
    const ipva = buildEvents(profile, TODAY).filter((e) => e.refId === 'ipva' && e.date < '2027-11-01');
    expect(ipva.map((e) => e.date)).toEqual(['2027-02-15']);
  });
  it('treats endMonth as inclusive', () => {
    const profile = makeProfile({
      entries: [{ id: 'x', kind: 'out', name: 'Curso', amount: 300, day: 20, recurrence: 'monthly', startMonth: '2026-11', endMonth: '2027-01' }],
    });
    expect(buildEvents(profile, TODAY).filter((e) => e.refId === 'x')).toHaveLength(3);
  });
  it('excludes a one-off entry dated before the balance date and includes one after it', () => {
    const profile = makeProfile({
      entries: [
        { id: 'old', kind: 'out', name: 'Antigo', amount: 100, day: 20, recurrence: 'once', startMonth: '2026-10', date: '2026-10-20' },
        { id: 'new', kind: 'out', name: 'Novo', amount: 100, day: 20, recurrence: 'once', startMonth: '2026-11', date: '2026-11-20' },
      ],
    });
    const ids = buildEvents(profile, TODAY).map((e) => e.refId);
    expect(ids).not.toContain('old');
    expect(ids).toContain('new');
  });
  it('pays a card entry through the invoice due date, not on the charge date', () => {
    const profile = makeProfile({
      entries: [
        ...makeProfile().entries,
        { id: 'net', kind: 'out', name: 'Streaming', amount: 50, day: 20, recurrence: 'monthly', startMonth: '2026-11', cardId: 'nu' },
      ],
    });
    expect(buildEvents(profile, TODAY).some((e) => e.refId === 'net')).toBe(false);
    expect(invoiceFor(profile, nubank, '2026-12', TODAY).total).toBe(850);
  });
  it('rejects an income charged on a card', () => {
    const profile = makeProfile({
      entries: [{ id: 'bad', kind: 'in', name: 'Estorno', amount: 10, day: 1, recurrence: 'monthly', startMonth: '2026-11', cardId: 'nu' }],
    });
    expect(() => buildEvents(profile, TODAY)).toThrow(/only outflows/);
  });
  it('orders same-day outflows before inflows', () => {
    const profile = makeProfile({
      entries: [{ id: 'sal', kind: 'in', name: 'Salário', amount: 6000, day: 12, recurrence: 'monthly', startMonth: '2026-01' }],
    });
    const sameDay = buildEvents(profile, TODAY).filter((e) => e.date === '2026-11-12');
    expect(sameDay.map((e) => e.source)).toEqual(['invoice', 'entry']);
  });
});

describe('balance projection', () => {
  it('finds the critical day as the lowest balance', () => {
    const profile = makeProfile();
    // 3000 + 6000 (5th) − 2000 (10th) − 2000 invoice (12th) = 5000
    const low = criticalDay(profileBalance(profile), buildEvents(profile, TODAY));
    expect(low).toEqual({ date: '2026-11-12', balance: 5000 });
  });
  it('projects 18 months by default', () => {
    const last = buildEvents(makeProfile(), TODAY).at(-1);
    expect(last?.date.slice(0, 7)).toBe('2028-04');
  });
  it('is empty-safe', () => {
    expect(cashProjection(100, [])).toEqual([]);
    expect(criticalDay(100, [])).toBeNull();
  });
});
