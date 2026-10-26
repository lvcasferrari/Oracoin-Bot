import type { Card } from '../../engine';
import type { SqlDriver } from '../driver';
import { cardFromRow, cardToParams, type CardRow } from '../mappers';

export const listCards = async (db: SqlDriver): Promise<Card[]> =>
  (await db.all<CardRow>('SELECT * FROM cards ORDER BY bank, name, id')).map(cardFromRow);

export const saveCard = (db: SqlDriver, c: Card) =>
  db.run(
    `INSERT INTO cards (id, bank, name, closing_day, due_day, limit_cents, variable_estimate_cents, available_informed_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET bank = excluded.bank, name = excluded.name, closing_day = excluded.closing_day,
       due_day = excluded.due_day, limit_cents = excluded.limit_cents,
       variable_estimate_cents = excluded.variable_estimate_cents, available_informed_cents = excluded.available_informed_cents`,
    cardToParams(c),
  );

/** Deletes the card with its invoices and installments; entries charged on it become account outflows. */
export const removeCard = (db: SqlDriver, id: string) => db.run('DELETE FROM cards WHERE id = ?', [id]);
