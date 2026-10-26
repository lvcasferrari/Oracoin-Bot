import { describe, expect, it } from 'vitest';
import { BANNED } from '../lib/copy';
import { suggestActions, type Action } from './actions';
import { daysBetween } from './dates';
import { makeProfile, nubank, TODAY } from './testing';
import type { Profile, Scenario } from './types';

const scenario = (changes: Scenario['changes']): Scenario => ({ id: 's', name: 't', changes });
const ids = (actions: Action[]) => actions.map((a) => a.id);

// No balance, salary on the 20th: the Nubank invoice on the 12th lands before payday.
const beforePayday = (): Profile =>
  makeProfile({
    accounts: [{ id: 'c', bank: 'Nubank', kind: 'corrente', balance: 0 }],
    entries: [{ id: 'sal', kind: 'in', name: 'Salário', amount: 6000, day: 20, recurrence: 'monthly', startMonth: '2026-01' }],
  });

describe('action catalog', () => {
  it('#1 suggests moving a due date that falls before payday', () => {
    const [move] = suggestActions(beforePayday(), null, TODAY).filter((a) => a.id === 1);
    expect(move.message).toMatch(/para o dia 23 deixa o mês no azul/);
    expect(move.impact).toMatchObject({ totalCost: 0 });
    expect(move.impact.criticalBalanceAfter).toBeGreaterThanOrEqual(0);
  });
  it('#1 and #3 stay silent when the month is comfortable', () => {
    expect(ids(suggestActions(makeProfile(), null, TODAY))).not.toContain(1);
    expect(ids(suggestActions(makeProfile(), null, TODAY))).not.toContain(3);
  });
  it('#3 compares paying in full with the capped cost of paying part', () => {
    const [pay] = suggestActions(beforePayday(), null, TODAY).filter((a) => a.id === 3);
    expect(pay.message).toMatch(/deixaria faltar R\$\s?2\.000,00/);
    expect(pay.impact.totalCost).toBeGreaterThan(0);
    expect(pay.assumptions.map((a) => a.key)).toContain('encargos_cap_ratio');
  });
  it('#2 shows the float gained by buying right after closing', () => {
    const actions = suggestActions(makeProfile(), scenario([{ type: 'purchase', cardId: 'nu', total: 600, installments: 3 }]), TODAY);
    const best = actions.find((a) => a.id === 2);
    // Bought on Nov 1 → due Nov 12 (11 days). Bought on Nov 5 → due Dec 12 (37 days).
    expect(best?.message).toMatch(/a partir de 05\/11.*37 dias até pagar, em vez de 11/);
    expect(daysBetween('2026-11-05', '2026-12-12')).toBe(37);
  });
  it('#6 proposes a ceiling when invoices pass the orange band', () => {
    const heavy = makeProfile({ installments: [{ id: 'p', cardId: 'nu', dueMonth: '2026-12', amount: 2000 }] });
    const ceiling = suggestActions(heavy, null, TODAY).find((a) => a.id === 6);
    expect(ceiling?.message).toMatch(/teto de R\$\s?1\.800,00 \(30% da renda\)/);
    expect(suggestActions(makeProfile(), null, TODAY).some((a) => a.id === 6)).toBe(false);
  });
  it('#8 finds how long to wait for a purchase to become comfortable', () => {
    const tightCard = { ...nubank, limit: 20000 };
    const p = makeProfile({ cards: [tightCard], accounts: [{ id: 'c', bank: 'Nubank', kind: 'corrente', balance: 500 }] });
    const wait = suggestActions(p, scenario([{ type: 'purchase', cardId: 'nu', total: 6000, installments: 2 }]), TODAY).find((a) => a.id === 8);
    expect(wait?.impact.monthsShift).toBeGreaterThanOrEqual(1);
    expect(wait?.message).toMatch(/^Se esperar \d+ (mês|meses), o cenário fica confortável\.$/);
  });
});

describe('action guardrails', () => {
  const all = [
    ...suggestActions(beforePayday(), null, TODAY),
    ...suggestActions(makeProfile(), scenario([{ type: 'purchase', cardId: 'nu', total: 6000, installments: 2 }]), TODAY),
    ...suggestActions(makeProfile({ installments: [{ id: 'p', cardId: 'nu', dueMonth: '2026-12', amount: 2000 }] }), null, TODAY),
  ];
  it('returns at most three, in a stable order', () => {
    const a = suggestActions(beforePayday(), null, TODAY);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(ids(suggestActions(beforePayday(), null, TODAY))).toEqual(ids(a));
  });
  it('always explains itself and has a finite cost', () => {
    expect(all.length).toBeGreaterThan(0);
    for (const a of all) {
      expect(a.why.trim()).not.toBe('');
      expect(Number.isFinite(a.impact.totalCost)).toBe(true);
    }
  });
  it('checks the balance whenever it mentions a date', () => {
    for (const a of all.filter((x) => /\d{2}\/\d{2}|dia \d+/.test(x.message))) {
      expect(Number.isFinite(a.impact.criticalBalanceAfter)).toBe(true);
    }
  });
  it('never blames, offers credit or suggests the overdraft', () => {
    for (const a of all) {
      const text = `${a.title} ${a.message} ${a.why}`.toLowerCase();
      for (const word of [...BANNED, 'cheque especial', 'empréstimo']) expect(text.includes(word), `${a.id}: ${word}`).toBe(false);
    }
  });
});
