import { USER_PARAMETER_SOURCE, type ParamKey, type Parameter } from '../../engine';
import type { SqlDriver } from '../driver';
import { parameterFromRow, parameterToParams, type ParameterRow } from '../mappers';

/** Source of every parameter row the user edits (removed by "apagar todos os meus dados"). */
export const USER_SOURCE = USER_PARAMETER_SOURCE;

export const listParameters = async (db: SqlDriver): Promise<Parameter[]> =>
  (await db.all<ParameterRow>('SELECT * FROM parameters ORDER BY key, effective_from, source')).map(parameterFromRow);

/**
 * Rows are dated and keyed by source, so a user edit never overwrites a seeded default (even on
 * the seed's own date); a second edit on the same day updates the first.
 */
export const saveParameter = (db: SqlDriver, p: Parameter) =>
  db.run(
    `INSERT INTO parameters (key, effective_from, value, source, note) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (key, effective_from, source) DO UPDATE SET value = excluded.value, note = excluded.note`,
    parameterToParams(p),
  );

/** "Restaurar padrão": drops the user's rows for a key so the seeded default applies again. */
export const restoreParameterDefault = (db: SqlDriver, key: ParamKey) =>
  db.run('DELETE FROM parameters WHERE key = ? AND source = ?', [key, USER_SOURCE]);
