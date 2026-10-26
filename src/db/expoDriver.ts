// The only file that imports values from expo-sqlite; tests never import it.
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { SqlDriver } from './driver';

export function expoDriver(db: SQLiteDatabase): SqlDriver {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => ({ changes: (await db.runAsync(sql, params)).changes }),
    all: (sql, params = []) => db.getAllAsync(sql, params),
    first: (sql, params = []) => db.getFirstAsync(sql, params),
    transaction: async (fn) => {
      let result: Awaited<ReturnType<typeof fn>> | undefined;
      // Every query inside runs on the exclusive `txn` connection.
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(expoDriver(txn));
      });
      return result as Awaited<ReturnType<typeof fn>>;
    },
  };
}

export async function openExpoDb(name: string): Promise<SqlDriver> {
  const db = await openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return expoDriver(db);
}
