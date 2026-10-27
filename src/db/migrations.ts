import type { SqlDriver } from './driver';

export interface Migration {
  version: number;
  sql: string;
}

// Append-only. Never edit a shipped migration; add version N+1 instead (versions stay 1..N).
// A new parameter key or a changed default ships as a migration inserting a new dated row.
const V1 = `
CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK (id = 1), balance_date TEXT NOT NULL,
  onboarded_at TEXT, onboarding_seconds INTEGER);
CREATE TABLE accounts (id TEXT PRIMARY KEY, bank TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('corrente','poupanca','carteira')), balance_cents INTEGER NOT NULL);
CREATE TABLE cards (id TEXT PRIMARY KEY, bank TEXT NOT NULL, name TEXT NOT NULL,
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31), limit_cents INTEGER NOT NULL,
  variable_estimate_cents INTEGER NOT NULL DEFAULT 0, available_informed_cents INTEGER);
CREATE TABLE entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('in','out')), name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL, day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  recurrence TEXT NOT NULL CHECK (recurrence IN ('once','monthly','yearly')), start_month TEXT NOT NULL,
  end_month TEXT, date TEXT, account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL, category TEXT,
  CHECK (card_id IS NULL OR kind = 'out'));
CREATE TABLE installments (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  due_month TEXT NOT NULL, amount_cents INTEGER NOT NULL);
CREATE TABLE invoices (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  due_month TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('estimada','confirmada')),
  status TEXT NOT NULL CHECK (status IN ('fechada','paga','parcial')), paid_cents INTEGER,
  partial_plan_months INTEGER, estimated_cents_at_confirm INTEGER, UNIQUE (card_id, due_month));
CREATE TABLE debts (id TEXT PRIMARY KEY, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('financiamento','emprestimo','hipoteca','pix_credito')),
  principal_cents INTEGER NOT NULL, monthly_rate REAL NOT NULL, months INTEGER NOT NULL,
  system TEXT NOT NULL CHECK (system IN ('price','sac')), start_month TEXT NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31));
CREATE TABLE goals (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL DEFAULT 0, deadline TEXT, priority INTEGER NOT NULL);
CREATE TABLE scenarios (id TEXT PRIMARY KEY, name TEXT NOT NULL, changes_json TEXT NOT NULL);
CREATE TABLE parameters (key TEXT NOT NULL, effective_from TEXT NOT NULL, value REAL NOT NULL,
  source TEXT NOT NULL, note TEXT, PRIMARY KEY (key, effective_from));
CREATE TABLE score_history (month TEXT PRIMARY KEY, total REAL NOT NULL, controle REAL NOT NULL,
  colchao REAL NOT NULL, metas REAL NOT NULL, liberdade REAL NOT NULL);

INSERT INTO profile (id, balance_date) VALUES (1, date('now', 'localtime'));

INSERT INTO parameters (key, effective_from, value, source) VALUES
  ('rotativo_monthly_rate', '2026-08-01', 0.1518, 'BCB ago/2026: 444,9% a.a. convertido para a.m.'),
  ('parcelado_fatura_monthly_rate', '2026-08-01', 0.0934, 'BCB ago/2026: 192,1% a.a. convertido para a.m.'),
  ('encargos_cap_ratio', '2024-01-03', 1, 'Lei 14.690/2023, Res. CMN 5.112; texto a confirmar'),
  ('partial_plan_default_months', '2026-10-26', 12, 'suposição do app'),
  ('projection_months', '2026-10-26', 18, 'spec 05: cobre parcelas de 12x e mais'),
  ('commitment_band_yellow', '2026-10-26', 0.2, 'referência do app'),
  ('commitment_band_orange', '2026-10-26', 0.3, 'referência do app (regra de 30% da renda, B3/Bora Investir)'),
  ('commitment_band_red', '2026-10-26', 0.5, 'referência do app (sinal de alerta usado pela CNC)'),
  ('verdict_tight_income_share', '2026-10-26', 0.1, 'referência do app'),
  ('verdict_attention_income_share', '2026-10-26', 0.25, 'referência do app'),
  ('verdict_limit_tight', '2026-10-26', 0.7, 'referência do app'),
  ('verdict_limit_attention', '2026-10-26', 0.4, 'referência do app'),
  ('reserve_target_months', '2026-10-26', 6, 'referência do app'),
  ('score_weight_controle', '2026-10-26', 0.25, 'referência do app'),
  ('score_weight_colchao', '2026-10-26', 0.25, 'referência do app'),
  ('score_weight_metas', '2026-10-26', 0.25, 'referência do app'),
  ('score_weight_liberdade', '2026-10-26', 0.25, 'referência do app'),
  ('controle_full_margin_share', '2026-10-26', 0.2, 'referência do app'),
  ('rotativo_lookback_months', '2026-10-26', 3, 'referência do app'),
  ('variable_estimate_uncertainty', '2026-10-26', 0.2, 'suposição do app'),
  ('purchase_on_closing_day_next_invoice', '2026-10-26', 1, 'sem fonte citável; editável (0 ou 1)');
`;

// v2 (review fixes): a user edit on a seed's date must not overwrite the seed, so the source joins
// the parameter key; invoices remember the day they were paid; new parameter for action #2.
const V2 = `
CREATE TABLE parameters_v2 (key TEXT NOT NULL, effective_from TEXT NOT NULL, value REAL NOT NULL,
  source TEXT NOT NULL, note TEXT, PRIMARY KEY (key, effective_from, source));
INSERT INTO parameters_v2 (key, effective_from, value, source, note) SELECT key, effective_from, value, source, note FROM parameters;
DROP TABLE parameters;
ALTER TABLE parameters_v2 RENAME TO parameters;
ALTER TABLE invoices ADD COLUMN paid_on TEXT;
INSERT INTO parameters (key, effective_from, value, source) VALUES ('best_day_max_wait_days', '2026-10-27', 7, 'referência do app');
`;

export const MIGRATIONS: Migration[] = [
  { version: 1, sql: V1 },
  { version: 2, sql: V2 },
];

/** Applies the missing migrations, each with its `user_version` bump in one transaction. */
export async function migrate(db: SqlDriver, migrations: Migration[] = MIGRATIONS): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= current) continue;
    if (!Number.isInteger(m.version)) throw new Error(`Invalid migration version ${m.version}`);
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}
