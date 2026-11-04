import type { Bridge } from '../../engine';
import type { SqlDriver } from '../driver';
import { bridgeFromRow, bridgeToParams, type BridgeRow } from '../mappers';

export const listBridges = async (db: SqlDriver): Promise<Bridge[]> =>
  (await db.all<BridgeRow>('SELECT * FROM bridges ORDER BY monthly_rate, name, id')).map(bridgeFromRow);

export const saveBridge = (db: SqlDriver, b: Bridge) =>
  db.run(
    `INSERT INTO bridges (id, name, kind, monthly_rate, months, effective_from, source) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, kind = excluded.kind, monthly_rate = excluded.monthly_rate,
       months = excluded.months, effective_from = excluded.effective_from, source = excluded.source`,
    bridgeToParams(b),
  );

export const removeBridge = (db: SqlDriver, id: string) => db.run('DELETE FROM bridges WHERE id = ?', [id]);
