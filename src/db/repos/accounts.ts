import type { Account } from '../../engine';
import type { SqlDriver } from '../driver';
import { accountFromRow, accountToParams, type AccountRow } from '../mappers';

export const listAccounts = async (db: SqlDriver): Promise<Account[]> =>
  (await db.all<AccountRow>('SELECT * FROM accounts ORDER BY bank, id')).map(accountFromRow);

// Upserts use ON CONFLICT DO UPDATE, never INSERT OR REPLACE (REPLACE deletes first and would cascade).
export const saveAccount = (db: SqlDriver, a: Account) =>
  db.run(
    `INSERT INTO accounts (id, bank, kind, balance_cents) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET bank = excluded.bank, kind = excluded.kind, balance_cents = excluded.balance_cents`,
    accountToParams(a),
  );

export const removeAccount = (db: SqlDriver, id: string) => db.run('DELETE FROM accounts WHERE id = ?', [id]);
