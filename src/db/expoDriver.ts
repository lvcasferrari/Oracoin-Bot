// The only file that imports values from expo-sqlite; tests never import it.
import { openDatabaseAsync } from 'expo-sqlite';
import type { SqlDriver, SqlParam } from './driver';
import { serialDriver } from './serialDriver';

export async function openExpoDb(name: string): Promise<SqlDriver> {
  const db = await openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  // Transactions stay on this connection (see serialDriver): withExclusiveTransactionAsync would open
  // a second connection without foreign_keys, and PRAGMA foreign_keys is a no-op inside a transaction.
  return serialDriver({
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params: SqlParam[]) => db.runAsync(sql, params),
    getAllAsync: <T,>(sql: string, params: SqlParam[]) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T,>(sql: string, params: SqlParam[]) => db.getFirstAsync<T>(sql, params),
  });
}
