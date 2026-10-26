import type { Goal } from '../../engine';
import type { SqlDriver } from '../driver';
import { goalFromRow, goalToParams, type GoalRow } from '../mappers';

export const listGoals = async (db: SqlDriver): Promise<Goal[]> =>
  (await db.all<GoalRow>('SELECT * FROM goals ORDER BY priority, name, id')).map(goalFromRow);

export const saveGoal = (db: SqlDriver, g: Goal) =>
  db.run(
    `INSERT INTO goals (id, name, target_cents, saved_cents, deadline, priority) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, target_cents = excluded.target_cents,
       saved_cents = excluded.saved_cents, deadline = excluded.deadline, priority = excluded.priority`,
    goalToParams(g),
  );

export const removeGoal = (db: SqlDriver, id: string) => db.run('DELETE FROM goals WHERE id = ?', [id]);
