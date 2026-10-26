import type { Entry } from '../../engine';
import type { SqlDriver } from '../driver';
import { entryFromRow, entryToParams, type EntryRow } from '../mappers';

export const listEntries = async (db: SqlDriver): Promise<Entry[]> =>
  (await db.all<EntryRow>('SELECT * FROM entries ORDER BY kind DESC, day, name, id')).map(entryFromRow);

export const saveEntry = (db: SqlDriver, e: Entry) =>
  db.run(
    `INSERT INTO entries (id, kind, name, amount_cents, day, recurrence, start_month, end_month, date, account_id, card_id, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, name = excluded.name, amount_cents = excluded.amount_cents,
       day = excluded.day, recurrence = excluded.recurrence, start_month = excluded.start_month,
       end_month = excluded.end_month, date = excluded.date, account_id = excluded.account_id,
       card_id = excluded.card_id, category = excluded.category`,
    entryToParams(e),
  );

export const removeEntry = (db: SqlDriver, id: string) => db.run('DELETE FROM entries WHERE id = ?', [id]);
