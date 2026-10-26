// Test-only driver on Node's built-in SQLite. Vite 5 cannot resolve `import 'node:sqlite'`,
// so it is loaded through createRequire.
import { createRequire } from 'node:module';
import type { SqlDriver, SqlParam } from './driver';

interface NodeStatement {
  run(...params: SqlParam[]): { changes: number | bigint };
  all(...params: SqlParam[]): unknown[];
  get(...params: SqlParam[]): unknown;
}
interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
}

export function nodeDriver(path = ':memory:'): SqlDriver & { close(): void } {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (path: string) => NodeDatabase };
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  let inTransaction = false;

  const driver: SqlDriver & { close(): void } = {
    exec: async (sql) => db.exec(sql),
    run: async (sql, params = []) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    all: async <T>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params) as T[],
    first: async <T>(sql: string, params: SqlParam[] = []) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
    transaction: async (fn) => {
      if (inTransaction) throw new Error('Nested transactions are not supported');
      inTransaction = true;
      db.exec('BEGIN');
      try {
        const result = await fn(driver);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
    },
    close: () => db.close(),
  };
  return driver;
}
