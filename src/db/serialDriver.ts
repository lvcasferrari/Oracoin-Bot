import type { SqlDriver, SqlParam } from './driver';

/** The part of expo-sqlite's SQLiteDatabase the app uses (small, so tests can fake it). */
export interface AsyncSqlite {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlParam[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlParam[]): Promise<T | null>;
}

/**
 * One connection, one queue. Every call waits for the previous one, and a transaction holds the
 * queue from BEGIN to COMMIT, so no other query can slip into it. Everything runs on the main
 * connection, which has PRAGMA foreign_keys = ON (a separate transaction connection would not).
 */
export function serialDriver(db: AsyncSqlite): SqlDriver {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };

  const direct: SqlDriver = {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => ({ changes: (await db.runAsync(sql, params)).changes }),
    all: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    first: <T>(sql: string, params: SqlParam[] = []) => db.getFirstAsync<T>(sql, params),
    transaction: () => Promise.reject(new Error('Nested transactions are not supported')),
  };

  return {
    exec: (sql) => enqueue(() => direct.exec(sql)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    all: <T>(sql: string, params?: SqlParam[]) => enqueue(() => direct.all<T>(sql, params)),
    first: <T>(sql: string, params?: SqlParam[]) => enqueue(() => direct.first<T>(sql, params)),
    transaction: (fn) =>
      enqueue(async () => {
        await db.execAsync('BEGIN IMMEDIATE');
        try {
          const result = await fn(direct);
          await db.execAsync('COMMIT');
          return result;
        } catch (error) {
          await db.execAsync('ROLLBACK');
          throw error;
        }
      }),
  };
}
