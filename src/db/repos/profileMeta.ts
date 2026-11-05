import type { SqlDriver } from '../driver';

export interface ProfileMeta {
  balanceDate: string;
  onboardedAt?: string;
  onboardingSeconds?: number;
  /** Invoice reminders (local notifications) switched on by the user. */
  reminders: boolean;
  /** The "complete depois" card on Hoje was dismissed. */
  laterDismissed: boolean;
}

interface ProfileRow {
  balance_date: string;
  onboarded_at: string | null;
  onboarding_seconds: number | null;
  reminders: number;
  later_dismissed: number;
}

export async function getProfileMeta(db: SqlDriver): Promise<ProfileMeta> {
  const row = await db.first<ProfileRow>('SELECT balance_date, onboarded_at, onboarding_seconds, reminders, later_dismissed FROM profile WHERE id = 1');
  if (!row) throw new Error('Profile row is missing; the database was not migrated');
  return {
    balanceDate: row.balance_date,
    onboardedAt: row.onboarded_at ?? undefined,
    onboardingSeconds: row.onboarding_seconds ?? undefined,
    reminders: row.reminders === 1,
    laterDismissed: row.later_dismissed === 1,
  };
}

export const setBalanceDate = (db: SqlDriver, date: string) => db.run('UPDATE profile SET balance_date = ? WHERE id = 1', [date]);

export const setOnboarded = (db: SqlDriver, at: string, seconds: number) =>
  db.run('UPDATE profile SET onboarded_at = ?, onboarding_seconds = ? WHERE id = 1', [at, Math.round(seconds)]);

export const setReminders = (db: SqlDriver, on: boolean) => db.run('UPDATE profile SET reminders = ? WHERE id = 1', [on ? 1 : 0]);

export const setLaterDismissed = (db: SqlDriver) => db.run('UPDATE profile SET later_dismissed = 1 WHERE id = 1');
