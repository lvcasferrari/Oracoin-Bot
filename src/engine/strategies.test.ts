import { describe, expect, it } from 'vitest';
import { debtViews, exploreStrategies, realizeStrategy } from './strategies';
import { DEFAULT_PARAMETERS } from './params';
import { makeProfile, TODAY } from './testing';
import type { Bridge, Debt, Entry, Profile } from './types';

const debt = (id: string, monthlyRate: number, principal = 6000): Debt => ({
  id, name: id, kind: 'emprestimo', principal, monthlyRate, months: 24, system: 'price', startMonth: '2026-11', dueDay: 20,
});
const bridge = (id: string, kind: Bridge['kind'], monthlyRate: number): Bridge => ({ id, name: id, kind, monthlyRate, months: 12, effectiveFrom: TODAY, source: 'teste' });
const bridges = [bridge('banco', 'emprestimo', 0.04), bridge('meta', 'meta', 0.01), bridge('fatura', 'parcelar_fatura', 0.0934)];

/** 30 entries, 4 debts and a one-off outflow: every combination needs a bridge, and income can repay it. */
function tight(): Profile {
  const base = makeProfile();
  const extra: Entry[] = Array.from({ length: 27 }, (_, k) => ({ id: `e${k}`, kind: 'out', name: `Conta ${k}`, amount: 20, day: 1 + (k % 28), recurrence: 'monthly', startMonth: '2026-01' }));
  const shock: Entry = { id: 'obra', kind: 'out', name: 'Obra', amount: 9000, day: 15, recurrence: 'once', startMonth: '2027-01', date: '2027-01-15' };
  // A one-month reserve, so every combination falls short and needs a bridge.
  const parameters = [...DEFAULT_PARAMETERS, { key: 'reserva_minima_months' as const, value: 1, effectiveFrom: '2026-10-27', source: 'teste' }];
  return { ...base, parameters, entries: [...base.entries, ...extra, shock], debts: [debt('a', 0.05, 2000), debt('b', 0.03, 2000), debt('c', 0.02, 2000), debt('d', 0.01, 2000)] };
}

describe('exploreStrategies', () => {
  it('tries 16 payoff sets × 2 spend levels × 3 bridges (96) in under a second', () => {
    const p = tight();
    expect(p.entries).toHaveLength(30);
    // Best of three: one wall-clock sample is noise when the machine is busy.
    let best = Infinity;
    let all: ReturnType<typeof exploreStrategies> = [];
    for (let k = 0; k < 3; k++) {
      const t = performance.now();
      all = exploreStrategies(p, bridges, TODAY, { top: 1000 });
      best = Math.min(best, performance.now() - t);
    }
    expect(best).toBeLessThan(1000);
    expect(all).toHaveLength(96);
  });
  it('never ranks a target ("meta") rate first, and a loan bridge covers the shortfall', () => {
    const all = exploreStrategies(tight(), bridges, TODAY);
    expect(all[0].bridge?.kind).not.toBe('meta');
    expect(all.some((s) => s.covered && s.bridge?.kind === 'emprestimo')).toBe(true);
  });
  it('without a shortfall the bridges collapse into one evaluation', () => {
    const p = { ...makeProfile({ debts: [debt('a', 0.05, 1000)] }), accounts: [{ id: 'conta', bank: 'X', kind: 'corrente' as const, balance: 30000 }] };
    const all = exploreStrategies(p, bridges, TODAY, { top: 1000 });
    expect(all).toHaveLength(4);
    expect(all.every((s) => s.bridge === null && s.covered)).toBe(true);
    // With spare cash, paying off the debt lowers the monthly cost.
    expect(all[0].payoffs.map((x) => x.debt.id)).toEqual(['a']);
    // Spending is outside the cost metric: on a tie, the strategy that needs no cut wins.
    expect(all[0].reducedVariable).toBe(false);
  });
  it('ranks by the chosen criterion, covered strategies first', () => {
    const all = exploreStrategies(tight(), bridges, TODAY, { criterion: 'menos_credito', top: 1000 });
    const covered = all.filter((s) => s.covered);
    expect(all.slice(0, covered.length).every((s) => s.covered)).toBe(true);
    // Leaving the metas out (one may have been moved behind the first real option), the order follows the criterion.
    const real = covered.filter((s) => s.bridge?.kind !== 'meta');
    expect(real.slice(1).every((s, k) => s.newCredit >= real[k].newCredit)).toBe(true);
  });
  it('skips debts that cannot be paid off early', () => {
    const p = { ...tight(), debts: [{ ...debt('a', 0.05), payoffable: false }] };
    expect(exploreStrategies(p, [], TODAY, { top: 1000 }).every((s) => s.payoffs.length === 0)).toBe(true);
  });
  it('rebuilds a chosen strategy with real ids', () => {
    const [best] = exploreStrategies(tight(), bridges, TODAY);
    let n = 0;
    const after = realizeStrategy(tight(), best, TODAY, (prefix) => `${prefix}-real${++n}`);
    expect(after.debts.length).toBe(best.after.debts.length);
    expect(after.entries.filter((e) => e.id.includes('-s')).length).toBe(0);
  });
});

describe('debtViews', () => {
  it('reads each debt against the informed credit and the cash yield, most expensive first', () => {
    const p = { ...makeProfile({ debts: [debt('cara', 0.06, 1000), debt('barata', 0.005, 1000), { ...debt('casa', 0.01), payoffable: false }] }), accounts: [{ id: 'c', bank: 'X', kind: 'corrente' as const, balance: 50000 }] };
    const views = debtViews(p, [bridge('banco', 'emprestimo', 0.04), bridge('meta', 'meta', 0.001)], TODAY);
    expect(views.map((v) => [v.debt.id, v.reading])).toEqual([
      ['cara', 'custa_mais_que_credito'],
      ['barata', 'deixar_correr'],
      ['casa', null],
    ]);
    expect(views[2].payoffAmount).toBeNull();
  });
  it('a payoff that pushes this month below doing nothing is not covered', () => {
    // 1.000 in the account and a 5.000 payoff now: the bridge cannot land before the payoff on the same day.
    const p = { ...makeProfile({ debts: [{ ...debt('a', 0.08, 5000), payoffAmount: 5000 }] }), accounts: [{ id: 'c', bank: 'X', kind: 'corrente' as const, balance: 1000 }] };
    const all = exploreStrategies(p, [bridge('banco', 'emprestimo', 0.03)], TODAY, { top: 1000 });
    expect(all.filter((s) => s.payoffs.length > 0).every((s) => !s.covered)).toBe(true);
    expect(all[0].payoffs).toHaveLength(0);
  });
});
