import { describe, expect, it } from 'vitest';
import { makeProfile, nubank } from '../../engine/testing';
import { migrate } from '../../db/migrations';
import { nodeDriver } from '../../db/nodeDriver';
import { listInvoices, listPayments, saveCard } from '../../db/repos';
import { confirmAtEstimate, markPaidInFull } from './quick';

const setup = async () => {
  const db = nodeDriver();
  await migrate(db);
  await saveCard(db, nubank);
  return db;
};

describe('one-tap upkeep', () => {
  it('confirms the projected invoice as is', async () => {
    const db = await setup();
    expect(await confirmAtEstimate(db, makeProfile(), 'nu', '2026-11', '2026-11-06')).toBe(true);
    expect(await listInvoices(db)).toEqual([expect.objectContaining({ cardId: 'nu', dueMonth: '2026-11', amount: 2000, origin: 'confirmada', status: 'fechada', estimatedAtConfirm: 2000 })]);
  });
  it('marks the invoice paid in full and logs the payment once, even when tapped twice', async () => {
    const db = await setup();
    const profile = makeProfile({ invoices: [{ id: 'i', cardId: 'nu', dueMonth: '2026-11', amount: 2100, origin: 'estimada', status: 'fechada' }] });
    await markPaidInFull(db, profile, 'nu', '2026-11', '2026-11-12');
    await markPaidInFull(db, profile, 'nu', '2026-11', '2026-11-12');
    expect(await listInvoices(db)).toEqual([expect.objectContaining({ id: 'i', amount: 2100, status: 'paga', paidAmount: 2100, paidOn: '2026-11-12', origin: 'confirmada' })]);
    expect(await listPayments(db)).toEqual([expect.objectContaining({ refId: 'nu', month: '2026-11', amount: 2100 })]);
  });
  it('does nothing for a card that no longer exists', async () => {
    const db = await setup();
    expect(await confirmAtEstimate(db, makeProfile(), 'gone', '2026-11', '2026-11-06')).toBe(false);
    expect(await listInvoices(db)).toEqual([]);
  });
});
