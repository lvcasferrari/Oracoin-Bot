import type { SqlDriver } from '../driver';

export interface ScoreSnapshot {
  month: string;
  total: number;
  controle: number;
  colchao: number;
  metas: number;
  liberdade: number;
}

export const listScoreHistory = (db: SqlDriver): Promise<ScoreSnapshot[]> =>
  db.all<ScoreSnapshot>('SELECT month, total, controle, colchao, metas, liberdade FROM score_history ORDER BY month');

export const saveScoreSnapshot = (db: SqlDriver, s: ScoreSnapshot) =>
  db.run(
    `INSERT INTO score_history (month, total, controle, colchao, metas, liberdade) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (month) DO UPDATE SET total = excluded.total, controle = excluded.controle, colchao = excluded.colchao,
       metas = excluded.metas, liberdade = excluded.liberdade`,
    [s.month, s.total, s.controle, s.colchao, s.metas, s.liberdade],
  );
