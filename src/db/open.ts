import type { SqlDriver } from './driver';
import { openExpoDb } from './expoDriver';
import { migrate } from './migrations';

export const DB_NAME = 'lsp.db';

/** Opens the on-device database and brings its schema up to date. */
export async function openDb(): Promise<SqlDriver> {
  const db = await openExpoDb(DB_NAME);
  await migrate(db);
  return db;
}
