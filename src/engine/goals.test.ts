import { describe, expect, it } from 'vitest';
import { goalDelays, goalTimeline, onTrack, type Contribution } from './goals';
import { healthScore, scoreTrend } from './score';
import { DEFAULT_PARAMETERS } from './params';
import { makeProfile, TODAY } from './testing';
import type { Goal } from './types';

const goal = (id: string, target: number, priority: number, extra: Partial<Goal> = {}): Goal => ({ id, name: id, target, saved: 0, priority, ...extra });
const months = (...amounts: number[]): Contribution[] => amounts.map((amount, k) => ({ month: `2027-${String(k + 1).padStart(2, '0')}`, amount }));

describe('goal timeline (priority waterfall)', () => {
  it('fills the top-priority goal first, then the next', () => {
    const result = goalTimeline([goal('b', 300, 2), goal('a', 200, 1)], months(100, 150, 50, 300));
    expect(result.map((r) => [r.goal.id, r.reachedMonth])).toEqual([['a', '2027-02'], ['b', '2027-04']]);
  });
  it('treats an already reached goal as reached in the first month', () => {
    expect(goalTimeline([goal('a', 100, 1, { saved: 100 })], months(0, 0))[0].reachedMonth).toBe('2027-01');
  });
  it('returns null when the horizon is not enough', () => {
    expect(goalTimeline([goal('a', 1000, 1)], months(100, 100))[0].reachedMonth).toBeNull();
  });
  it('checks the deadline month for "on track"', () => {
    expect(onTrack({ goal: goal('a', 1, 1, { deadline: '2027-02-28' }), reachedMonth: '2027-02' })).toBe(true);
    expect(onTrack({ goal: goal('a', 1, 1, { deadline: '2027-01-31' }), reachedMonth: '2027-02' })).toBe(false);
  });
});

describe('goal delays', () => {
  const base = makeProfile({ goals: [goal('reserva', 4000, 1)] }); // margin 2000 in Nov, 3200 after
  it('reports how many months a change delays a goal', () => {
    const withCost = makeProfile({
      goals: base.goals,
      entries: [...base.entries, { id: 'x', kind: 'out', name: 'Assinatura', amount: 2500, day: 15, recurrence: 'monthly', startMonth: '2026-11' }],
    });
    const [d] = goalDelays(base, withCost, TODAY);
    expect(d.baseline).toBe('2026-12');
    expect(d.delayMonths).toBeGreaterThan(0);
  });
  it('flags a goal that stops being reachable', () => {
    const broke = makeProfile({ goals: base.goals, entries: [] });
    expect(goalDelays(base, broke, TODAY)[0]).toMatchObject({ scenario: null, delayMonths: null });
  });
});

describe('health score', () => {
  it('stays within 0–100 and explains what helps most', () => {
    const s = healthScore(makeProfile(), TODAY);
    for (const v of Object.values(s.parts)) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    expect(s.noGoals).toBe(true);
    expect(s.topImprovement).toMatch(/melhora sua nota|em dia/);
  });
  it('never returns NaN without income', () => {
    const s = healthScore(makeProfile({ entries: [] }), TODAY);
    expect(s.parts.controle).toBe(0);
    expect(s.parts.liberdade).toBe(0);
    expect(Number.isNaN(s.total)).toBe(false);
  });
  it('zeroes freedom after a recent partial payment, but not after an old one', () => {
    const partial = (dueMonth: string) => ({ id: 'p', cardId: 'nu', dueMonth, amount: 2000, origin: 'confirmada' as const, status: 'parcial' as const, paidAmount: 500 });
    expect(healthScore(makeProfile({ invoices: [partial('2026-10')] }), TODAY).parts.liberdade).toBe(0);
    expect(healthScore(makeProfile({ invoices: [partial('2026-05')] }), TODAY).parts.liberdade).toBeGreaterThan(0);
  });
  it('normalises weights that do not sum to 1', () => {
    const heavy = [...DEFAULT_PARAMETERS, { key: 'score_weight_controle' as const, value: 3, effectiveFrom: '2026-10-30', source: 't' }];
    const s = healthScore(makeProfile({ parameters: heavy }), TODAY);
    expect(s.total).toBeLessThanOrEqual(100);
  });
  it('describes the trend against three months back', () => {
    expect(scoreTrend([{ month: '2026-08', total: 60 }], '2026-11', 66)).toBe('↑ 6 pontos em 3 meses.');
    expect(scoreTrend([{ month: '2026-10', total: 70 }], '2026-11', 69)).toBe('↓ 1 ponto em 1 mês.');
    expect(scoreTrend([], '2026-11', 50)).toBeNull();
  });
});
