import { describe, expect, it } from 'vitest';
import { paymentHistory, paymentId } from './history';
import { makeProfile, TODAY } from './testing';

const debt = { id: 'car', name: 'Carro', kind: 'financiamento' as const, principal: 2400, monthlyRate: 0, months: 12, system: 'price' as const, startMonth: '2026-09', dueDay: 20 };

describe('paymentHistory', () => {
  it('lists due invoices and instalments per month, newest first, with what was paid', () => {
    const p = makeProfile({ debts: [debt] });
    const paid = [{ id: paymentId('debt', 'car', '2026-10'), refType: 'debt' as const, refId: 'car', month: '2026-10', paidOn: '2026-10-20', amount: 200 }];
    const [nov, oct] = paymentHistory(p, paid, TODAY, 2);
    expect(nov.month).toBe('2026-11');
    expect(oct.items.find((i) => i.refId === 'car')).toMatchObject({ due: 200, paid: 200 });
    expect(nov.items.find((i) => i.refId === 'car')?.paid).toBeNull();
    expect(nov.items.some((i) => i.refType === 'invoice' && i.refId === 'nu')).toBe(true);
    expect(oct.paid).toBe(200);
  });
});
