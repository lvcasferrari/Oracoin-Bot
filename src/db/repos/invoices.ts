import type { Invoice } from '../../engine';
import type { SqlDriver } from '../driver';
import { invoiceFromRow, invoiceToParams, type InvoiceRow } from '../mappers';

export const listInvoices = async (db: SqlDriver): Promise<Invoice[]> =>
  (await db.all<InvoiceRow>('SELECT * FROM invoices ORDER BY card_id, due_month')).map(invoiceFromRow);

/** One invoice per card and month: saving again for the same month updates it. */
export const saveInvoice = (db: SqlDriver, i: Invoice) =>
  db.run(
    `INSERT INTO invoices (id, card_id, due_month, amount_cents, origin, status, paid_cents, partial_plan_months, estimated_cents_at_confirm, paid_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (card_id, due_month) DO UPDATE SET amount_cents = excluded.amount_cents, origin = excluded.origin,
       status = excluded.status, paid_cents = excluded.paid_cents, partial_plan_months = excluded.partial_plan_months,
       estimated_cents_at_confirm = excluded.estimated_cents_at_confirm, paid_on = excluded.paid_on`,
    invoiceToParams(i),
  );

export const removeInvoice = (db: SqlDriver, id: string) => db.run('DELETE FROM invoices WHERE id = ?', [id]);
