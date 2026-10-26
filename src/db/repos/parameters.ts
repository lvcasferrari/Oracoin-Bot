import type { ParamKey, Parameter } from '../../engine';
import type { SqlDriver } from '../driver';
import { parameterFromRow, parameterToParams, type ParameterRow } from '../mappers';

/** Source of every parameter row the user edits (removed by "apagar todos os meus dados"). */
export const USER_SOURCE = 'editado por você';

export const listParameters = async (db: SqlDriver): Promise<Parameter[]> =>
  (await db.all<ParameterRow>('SELECT * FROM parameters ORDER BY key, effective_from')).map(parameterFromRow);

/** Rows are dated and never overwritten across dates; a same-day edit updates that day's row. */
export const saveParameter = (db: SqlDriver, p: Parameter) =>
  db.run(
    `INSERT INTO parameters (key, effective_from, value, source, note) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (key, effective_from) DO UPDATE SET value = excluded.value, source = excluded.source, note = excluded.note`,
    parameterToParams(p),
  );

/** "Restaurar padrão": drops the user's rows for a key so the seeded default applies again. */
export const restoreParameterDefault = (db: SqlDriver, key: ParamKey) =>
  db.run('DELETE FROM parameters WHERE key = ? AND source = ?', [key, USER_SOURCE]);
