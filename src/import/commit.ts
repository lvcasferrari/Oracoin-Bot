import type { SqlDriver } from '../db/driver';
import { saveAccount, saveCard, saveDebt, saveEntry, saveInstallment, saveScenario, setBalanceDate } from '../db/repos';
import type { ImportPreview, Row } from './mapWorkbook';

export type DuplicateMode = 'skip' | 'replace';

/** "Importar": writes the preview in one transaction (all or nothing). Cards go before what refers to them. */
export async function commitImport(db: SqlDriver, preview: ImportPreview, mode: DuplicateMode, today: string): Promise<number> {
  const keep = <T>(rows: Row<T>[]) => rows.filter((r) => mode === 'replace' || !r.duplicate).map((r) => r.value);
  const accounts = keep(preview.accounts);
  const groups = [accounts, keep(preview.cards), keep(preview.entries), keep(preview.installments), keep(preview.debts), keep(preview.scenarios)];
  await db.transaction(async (tx) => {
    for (const a of accounts) await saveAccount(tx, a);
    for (const c of keep(preview.cards)) await saveCard(tx, c);
    for (const e of keep(preview.entries)) await saveEntry(tx, e);
    for (const i of keep(preview.installments)) await saveInstallment(tx, i);
    for (const d of keep(preview.debts)) await saveDebt(tx, d);
    for (const s of keep(preview.scenarios)) await saveScenario(tx, s);
    // Balances typed in the spreadsheet are taken as today's balances.
    if (accounts.length > 0) await setBalanceDate(tx, today);
  });
  return groups.reduce((s, g) => s + g.length, 0);
}
