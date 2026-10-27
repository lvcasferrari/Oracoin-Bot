import type { Scenario, ScenarioRows } from '../../engine';
import type { SqlDriver } from '../driver';
import { scenarioFromRow, scenarioToParams, type ScenarioRow } from '../mappers';
import { saveDebt } from './debts';
import { saveEntry } from './entries';
import { saveInstallment } from './installments';
import { saveInvoice } from './invoices';

export const listScenarios = async (db: SqlDriver): Promise<Scenario[]> =>
  (await db.all<ScenarioRow>('SELECT * FROM scenarios ORDER BY name, id')).map(scenarioFromRow);

export const saveScenario = (db: SqlDriver, s: Scenario) =>
  db.run(
    `INSERT INTO scenarios (id, name, changes_json) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, changes_json = excluded.changes_json`,
    scenarioToParams(s),
  );

export const removeScenario = (db: SqlDriver, id: string) => db.run('DELETE FROM scenarios WHERE id = ?', [id]);

/** "Seguir com isso": writes the scenario's rows into the repository, all or nothing. */
export async function commitScenario(db: SqlDriver, rows: ScenarioRows): Promise<void> {
  await db.transaction(async (tx) => {
    for (const e of rows.entries) await saveEntry(tx, e);
    for (const i of rows.installments) await saveInstallment(tx, i);
    for (const d of rows.debts) await saveDebt(tx, d);
    for (const i of rows.invoices) await saveInvoice(tx, i);
  });
}
