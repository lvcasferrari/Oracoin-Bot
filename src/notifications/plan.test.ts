import { describe, expect, it } from 'vitest';
import { makeProfile } from '../engine/testing';
import type { Invoice } from '../engine';
import { formatBRL } from '../lib/money';
import { planReminders } from './plan';

// Nubank closes on the 5th and is due on the 12th; the projection is R$ 2.000,00.
const inv = (overrides: Partial<Invoice>): Invoice => ({ id: 'i', cardId: 'nu', dueMonth: '2026-11', amount: 2100, origin: 'estimada', status: 'fechada', ...overrides });

describe('planReminders', () => {
  it('plans "fechou" on the closing day and "vence hoje" on the due date, future days only', () => {
    const plan = planReminders(makeProfile(), '2026-11-01');
    expect(plan.slice(0, 2)).toEqual([
      expect.objectContaining({ id: 'confirm-nu-2026-11', date: '2026-11-05', kind: 'confirm', body: expect.stringContaining(formatBRL(2000)) }),
      expect.objectContaining({ id: 'pay-nu-2026-11', date: '2026-11-12', kind: 'pay' }),
    ]);
    expect(planReminders(makeProfile(), '2026-11-05').map((r) => r.id)).not.toContain('confirm-nu-2026-11');
    expect(planReminders(makeProfile(), '2026-11-12').map((r) => r.id)).not.toContain('pay-nu-2026-11');
  });
  it('covers three invoice months, at most two reminders each', () => {
    expect(planReminders(makeProfile(), '2026-11-01').map((r) => r.dueMonth)).toEqual(['2026-11', '2026-11', '2026-12', '2026-12', '2027-01', '2027-01']);
  });
  it('drops the questions already answered', () => {
    const confirmed = planReminders(makeProfile({ invoices: [inv({ origin: 'confirmada' })] }), '2026-11-01');
    expect(confirmed.map((r) => r.id)).not.toContain('confirm-nu-2026-11');
    expect(confirmed.find((r) => r.id === 'pay-nu-2026-11')?.body).toContain(formatBRL(2100));
    const paid = planReminders(makeProfile({ invoices: [inv({ origin: 'confirmada', status: 'paga' })] }), '2026-11-01');
    expect(paid.map((r) => r.id)).not.toContain('pay-nu-2026-11');
  });
  it('plans nothing for an empty invoice', () => {
    expect(planReminders(makeProfile({ invoices: [inv({ amount: 0 })] }), '2026-11-01').map((r) => r.dueMonth)).not.toContain('2026-11');
  });
});
