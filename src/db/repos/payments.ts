import type { Payment } from '../../engine';
import type { SqlDriver } from '../driver';
import { paymentFromRow, paymentToParams, type PaymentRow } from '../mappers';

export const listPayments = async (db: SqlDriver): Promise<Payment[]> =>
  (await db.all<PaymentRow>('SELECT * FROM payments ORDER BY month DESC, paid_on DESC, id')).map(paymentFromRow);

export const savePayment = (db: SqlDriver, p: Payment) =>
  db.run(
    `INSERT INTO payments (id, ref_type, ref_id, month, paid_on, amount_cents) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET paid_on = excluded.paid_on, amount_cents = excluded.amount_cents`,
    paymentToParams(p),
  );

export const removePayment = (db: SqlDriver, id: string) => db.run('DELETE FROM payments WHERE id = ?', [id]);
