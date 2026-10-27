import { describe, expect, it } from 'vitest';
import { serialDriver, type AsyncSqlite } from './serialDriver';

/** Records statements in order; each call takes a little time, like the real async bridge. */
function fake() {
  const log: string[] = [];
  const tick = () => new Promise((r) => setTimeout(r, 2));
  const db: AsyncSqlite = {
    execAsync: async (sql) => {
      await tick();
      log.push(sql);
    },
    runAsync: async (sql) => {
      await tick();
      if (sql === 'FAIL') throw new Error('boom');
      log.push(sql);
      return { changes: 1 };
    },
    getAllAsync: async <T,>(sql: string) => {
      await tick();
      log.push(sql);
      return [] as T[];
    },
    getFirstAsync: async <T,>(sql: string) => {
      await tick();
      log.push(sql);
      return null as T | null;
    },
  };
  return { db, log };
}

describe('serialDriver', () => {
  it('keeps other queries out of a running transaction', async () => {
    const { db, log } = fake();
    const driver = serialDriver(db);
    const tx = driver.transaction(async (t) => {
      await t.run('INSERT A');
      await t.run('INSERT B');
    });
    const outside = driver.run('UPDATE OUTSIDE');
    await Promise.all([tx, outside]);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'INSERT A', 'INSERT B', 'COMMIT', 'UPDATE OUTSIDE']);
  });

  it('rolls back and keeps the queue working after a failure', async () => {
    const { db, log } = fake();
    const driver = serialDriver(db);
    await expect(
      driver.transaction(async (t) => {
        await t.run('INSERT A');
        await t.run('FAIL');
      }),
    ).rejects.toThrow('boom');
    await driver.run('AFTER');
    expect(log).toEqual(['BEGIN IMMEDIATE', 'INSERT A', 'ROLLBACK', 'AFTER']);
  });

  it('refuses nested transactions', async () => {
    const { db } = fake();
    const driver = serialDriver(db);
    await expect(driver.transaction((t) => t.transaction(async () => undefined))).rejects.toThrow('Nested');
  });
});
