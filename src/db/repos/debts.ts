import type { Debt } from '../../engine';
import type { SqlDriver } from '../driver';
import { debtFromRow, debtToParams, type DebtRow } from '../mappers';

export const listDebts = async (db: SqlDriver): Promise<Debt[]> =>
  (await db.all<DebtRow>('SELECT * FROM debts ORDER BY start_month, name, id')).map(debtFromRow);

export const saveDebt = (db: SqlDriver, d: Debt) =>
  db.run(
    `INSERT INTO debts (id, name, kind, principal_cents, monthly_rate, months, system, start_month, due_day,
       paid_off_month, payoff_amount_cents, payoff_discount_annual, payoff_quoted_on, payoffable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, kind = excluded.kind, principal_cents = excluded.principal_cents,
       monthly_rate = excluded.monthly_rate, months = excluded.months, system = excluded.system,
       start_month = excluded.start_month, due_day = excluded.due_day, paid_off_month = excluded.paid_off_month,
       payoff_amount_cents = excluded.payoff_amount_cents, payoff_discount_annual = excluded.payoff_discount_annual,
       payoff_quoted_on = excluded.payoff_quoted_on, payoffable = excluded.payoffable`,
    debtToParams(d),
  );

export const removeDebt = (db: SqlDriver, id: string) => db.run('DELETE FROM debts WHERE id = ?', [id]);
