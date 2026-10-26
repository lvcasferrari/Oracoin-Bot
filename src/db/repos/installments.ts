import type { Installment } from '../../engine';
import type { SqlDriver } from '../driver';
import { installmentFromRow, installmentToParams, type InstallmentRow } from '../mappers';

export const listInstallments = async (db: SqlDriver): Promise<Installment[]> =>
  (await db.all<InstallmentRow>('SELECT * FROM installments ORDER BY card_id, due_month, id')).map(installmentFromRow);

export const saveInstallment = (db: SqlDriver, i: Installment) =>
  db.run(
    `INSERT INTO installments (id, card_id, due_month, amount_cents) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET card_id = excluded.card_id, due_month = excluded.due_month, amount_cents = excluded.amount_cents`,
    installmentToParams(i),
  );

export const removeInstallment = (db: SqlDriver, id: string) => db.run('DELETE FROM installments WHERE id = ?', [id]);

/**
 * Replaces one card's monthly installment sums from `fromMonth` on, in one transaction (the month
 * grid form). Months before `fromMonth` are left as they are.
 */
export async function replaceCardInstallments(db: SqlDriver, cardId: string, fromMonth: string, rows: Installment[]): Promise<void> {
  if (rows.some((r) => r.cardId !== cardId || r.dueMonth < fromMonth)) throw new Error('Installments must belong to the card and the edited months');
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM installments WHERE card_id = ? AND due_month >= ?', [cardId, fromMonth]);
    for (const r of rows) if (r.amount > 0) await saveInstallment(tx, r);
  });
}
