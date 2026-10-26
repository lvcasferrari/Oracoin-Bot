// Regression tests for the bugs found by the code review of 2026-10-26 (each reproduced first).
import { describe, expect, it } from 'vitest';
import { suggestActions } from './actions';
import { priceSchedule, sacSchedule } from './debt';
import { buildEvents, invoiceFor } from './events';
import { goalTimeline, onTrack } from './goals';
import { DEFAULT_PARAMETERS, paramRow, USER_PARAMETER_SOURCE } from './params';
import { applyChanges, evaluate } from './scenarios';
import { healthScore } from './score';
import { makeProfile, nubank, TODAY } from './testing';
import type { Invoice, Parameter } from './types';

const scenario = (changes: Parameters<typeof evaluate>[1]['changes']) => ({ id: 's', name: 't', changes });

describe('review fixes', () => {
  it('adds a scenario purchase to a user-typed invoice estimate instead of hiding it', () => {
    const estimate: Invoice = { id: 'e', cardId: 'nu', dueMonth: '2026-11', amount: 2000, origin: 'estimada', status: 'fechada' };
    const after = applyChanges(makeProfile({ invoices: [estimate] }), [{ type: 'purchase', cardId: 'nu', total: 5000, installments: 1 }], TODAY);
    expect(invoiceFor(after, nubank, '2026-11', TODAY).total).toBe(7000);
  });

  it('does not subtract an invoice paid before the balance date twice', () => {
    const paid: Invoice = { id: 'p', cardId: 'nu', dueMonth: '2026-11', amount: 2000, origin: 'confirmada', status: 'paga', paidAmount: 2000, paidOn: '2026-11-08' };
    const profile = makeProfile({ balanceDate: '2026-11-08', accounts: [{ id: 'c', bank: 'Nubank', kind: 'corrente', balance: 1000 }], invoices: [paid] });
    const events = buildEvents(profile, '2026-11-08');
    expect(events.some((e) => e.source === 'invoice' && e.date === '2026-11-12')).toBe(false);
  });

  it('still counts a paid invoice when the balance was informed before the payment', () => {
    const paid: Invoice = { id: 'p', cardId: 'nu', dueMonth: '2026-11', amount: 2000, origin: 'confirmada', status: 'paga', paidAmount: 2000, paidOn: '2026-11-08' };
    const events = buildEvents(makeProfile({ invoices: [paid] }), TODAY);
    expect(events.find((e) => e.source === 'invoice' && e.date === '2026-11-12')?.amount).toBe(-2000);
  });

  it('prefers a user edit over the seeded default on the same date', () => {
    const params: Parameter[] = [
      ...DEFAULT_PARAMETERS,
      { key: 'reserve_target_months', value: 3, effectiveFrom: '2026-10-26', source: USER_PARAMETER_SOURCE },
    ];
    expect(paramRow(params, 'reserve_target_months', TODAY).value).toBe(3);
    expect(paramRow(DEFAULT_PARAMETERS, 'reserve_target_months', TODAY).value).toBe(6);
  });

  it('starts a new subscription next month when its day already passed', () => {
    const profile = makeProfile({ balanceDate: '2026-11-20' });
    const after = applyChanges(profile, [{ type: 'subscription', amount: 100, day: 5, cardId: 'nu' }], '2026-11-20');
    expect(after.entries.find((e) => e.name === 'Nova assinatura')?.startMonth).toBe('2026-12');
  });

  it('treats a funded lower-priority goal as reached even while a bigger goal is open', () => {
    const [, funded] = goalTimeline(
      [
        { id: 'a', name: 'Casa', target: 100000, saved: 0, priority: 1 },
        { id: 'b', name: 'Viagem', target: 1000, saved: 1000, priority: 2, deadline: '2026-12-31' },
      ],
      [{ month: '2026-11', amount: 500 }, { month: '2026-12', amount: 500 }],
    );
    expect(funded.reachedMonth).toBe('2026-11');
    expect(onTrack(funded)).toBe(true);
  });

  it('does not call a near-zero balance comfortable when the salary only starts next month', () => {
    const profile = makeProfile({
      entries: [{ id: 'sal', kind: 'in', name: 'Salário', amount: 6000, day: 5, recurrence: 'monthly', startMonth: '2026-12' }],
    });
    // 3000 − 2000 (Nov invoice) − 999 purchase on the open invoice = R$ 1,00 on Nov 12.
    const r = evaluate(profile, scenario([{ type: 'purchase', cardId: 'nu', total: 999, installments: 1 }]), TODAY);
    expect(r.result.critical?.balance).toBe(1);
    expect(r.verdict).not.toBe('confortavel');
  });

  it('never returns NaN when two commitment bands are edited to the same value', () => {
    const same: Parameter[] = [
      ...DEFAULT_PARAMETERS,
      { key: 'commitment_band_yellow', value: 0.3, effectiveFrom: '2026-10-30', source: USER_PARAMETER_SOURCE },
      { key: 'commitment_band_red', value: 0.3, effectiveFrom: '2026-10-30', source: USER_PARAMETER_SOURCE },
    ];
    expect(Number.isFinite(healthScore(makeProfile({ parameters: same }), TODAY).total)).toBe(true);
  });

  it('keeps every schedule row non-negative for small principals over long terms', () => {
    for (const rows of [sacSchedule(1000, 0.01, 600), priceSchedule(1000, 0.01, 360)]) {
      expect(rows.every((r) => r.payment >= 0 && r.amortization >= 0)).toBe(true);
      expect(rows.at(-1)?.balance).toBe(0);
    }
  });

  it('does not suggest waiting most of a cycle for the "best purchase day"', () => {
    const late = suggestActions(makeProfile(), scenario([{ type: 'purchase', cardId: 'nu', total: 600, installments: 3, date: '2026-11-06' }]), TODAY);
    expect(late.some((a) => a.id === 2)).toBe(false);
  });

  it('ranks free actions before the cost of paying part of an invoice', () => {
    const profile = makeProfile({
      accounts: [{ id: 'c', bank: 'Nubank', kind: 'corrente', balance: 0 }],
      entries: [{ id: 'sal', kind: 'in', name: 'Salário', amount: 6000, day: 20, recurrence: 'monthly', startMonth: '2026-01' }],
    });
    const ids = suggestActions(profile, null, TODAY).map((a) => a.id);
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(3));
  });
});
