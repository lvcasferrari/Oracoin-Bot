import { describe, expect, it } from 'vitest';
import { buildEvents, criticalDay, profileBalance } from './events';
import { criticalMonth, dailyView, dueCalendar, monthlySummary, type MonthRow } from './summary';
import { makeProfile, TODAY } from './testing';
import type { Debt } from './types';

const debt: Debt = { id: 'carro', name: 'Carro', kind: 'financiamento', principal: 12000, monthlyRate: 0.01, months: 12, system: 'sac', startMonth: '2026-12', dueDay: 15 };

describe('monthly summary', () => {
  it('covers the projection horizon from this month', () => {
    const rows = monthlySummary(makeProfile(), TODAY);
    expect(rows).toHaveLength(18);
    expect(rows[0].month).toBe('2026-11');
    expect(rows.at(-1)?.month).toBe('2028-04');
  });
  it('splits the month into income, outflows, invoices and debts', () => {
    const [, dec] = monthlySummary(makeProfile({ debts: [debt] }), TODAY);
    expect(dec).toMatchObject({ month: '2026-12', income: 6000, outflows: 2000, invoices: 800, debts: 1120, margin: 2080, estimated: true });
  });
  it('carries the end balance month to month', () => {
    const [nov, dec] = monthlySummary(makeProfile(), TODAY);
    // Nov: 3000 + 6000 − 2000 − 2000 = 5000; Dec: + 6000 − 2000 − 800 = 8200
    expect(nov.endBalance).toBe(5000);
    expect(dec.endBalance).toBe(8200);
    expect(nov.lowBalance).toBe(5000);
  });
  it('marks as critical the month that holds the critical day', () => {
    const profile = makeProfile({ debts: [debt] });
    const day = criticalDay(profileBalance(profile), buildEvents(profile, TODAY));
    expect(criticalMonth(monthlySummary(profile, TODAY))?.month).toBe(day?.date.slice(0, 7));
  });
  it('picks the earliest month on a tie', () => {
    const rows = [{ month: '2026-11', lowBalance: 10 }, { month: '2026-12', lowBalance: 10 }] as MonthRow[];
    expect(criticalMonth(rows)?.month).toBe('2026-11');
    expect(criticalMonth([])).toBeNull();
  });
});

describe('due calendar and daily view', () => {
  it('lists outflows by date, largest first on the same day', () => {
    const profile = makeProfile({
      entries: [
        ...makeProfile().entries,
        { id: 'luz', kind: 'out', name: 'Luz', amount: 150, day: 12, recurrence: 'monthly', startMonth: '2026-01' },
      ],
    });
    const calendar = dueCalendar(profile, '2026-11', TODAY);
    expect(calendar.map((e) => [e.date.slice(8), e.amount])).toEqual([['10', -2000], ['12', -2000], ['12', -150]]);
  });
  it('shows each event of the month with the running balance', () => {
    const rows = dailyView(makeProfile(), '2026-12', TODAY);
    expect(rows.map((r) => [r.date.slice(8), r.balance])).toEqual([['05', 11000], ['10', 9000], ['12', 8200]]);
  });
});
