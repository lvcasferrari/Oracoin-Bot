import type { SqlDriver } from './driver';
import { USER_SOURCE } from './repos/parameters';

/**
 * "Apagar todos os meus dados" (LGPD): empties every table, including ones added later,
 * keeps only the seeded default parameters, and recreates the profile row. Then rewrites the
 * file and empties the write-ahead log so deleted rows do not linger in free pages.
 */
export async function resetAll(db: SqlDriver, today: string): Promise<void> {
  await db.transaction(async (tx) => {
    const tables = await tx.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    for (const { name } of tables) {
      if (name === 'parameters') continue;
      // Table names come from sqlite_master (our own schema), never from user input.
      await tx.exec(`DELETE FROM "${name.replace(/"/g, '""')}"`);
    }
    await tx.run('DELETE FROM parameters WHERE source = ?', [USER_SOURCE]);
    await tx.run('INSERT INTO profile (id, balance_date) VALUES (1, ?)', [today]);
  });
  // Outside the transaction: VACUUM cannot run inside one. Not forensic-grade, but no leftovers in the file.
  await db.exec('VACUUM');
  await db.first('PRAGMA wal_checkpoint(TRUNCATE)');
}
