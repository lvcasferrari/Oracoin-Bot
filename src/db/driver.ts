export type SqlParam = string | number | null;

/**
 * The only database surface the app and the tests use. Always parameterised queries.
 * `transaction` must never be nested.
 */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
}
