import type { Scenario } from '../../engine';
import type { SqlDriver } from '../driver';
import { scenarioFromRow, scenarioToParams, type ScenarioRow } from '../mappers';

export const listScenarios = async (db: SqlDriver): Promise<Scenario[]> =>
  (await db.all<ScenarioRow>('SELECT * FROM scenarios ORDER BY name, id')).map(scenarioFromRow);

export const saveScenario = (db: SqlDriver, s: Scenario) =>
  db.run(
    `INSERT INTO scenarios (id, name, changes_json) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, changes_json = excluded.changes_json`,
    scenarioToParams(s),
  );

export const removeScenario = (db: SqlDriver, id: string) => db.run('DELETE FROM scenarios WHERE id = ?', [id]);
