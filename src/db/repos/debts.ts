import type { Debt } from '../../engine';
import type { SqlDriver } from '../driver';
import { debtFromRow, debtToParams, type DebtRow } from '../mappers';

export const listDebts = async (db: SqlDriver): Promise<Debt[]> =>
  (await db.all<DebtRow>('SELECT * FROM debts ORDER BY start_month, name, id')).map(debtFromRow);

export const saveDebt = (db: SqlDriver, d: Debt) =>
  db.run(
    `INSERT INTO debts (id, name, kind, principal_cents, monthly_rate, months, system, start_month, due_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, kind = excluded.kind, principal_cents = excluded.principal_cents,
       monthly_rate = excluded.monthly_rate, months = excluded.months, system = excluded.system,
       start_month = excluded.start_month, due_day = excluded.due_day`,
    debtToParams(d),
  );

export const removeDebt = (db: SqlDriver, id: string) => db.run('DELETE FROM debts WHERE id = ?', [id]);
