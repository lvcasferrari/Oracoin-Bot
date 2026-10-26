import type { SqlDriver } from '../driver';

export interface ProfileMeta {
  balanceDate: string;
  onboardedAt?: string;
  onboardingSeconds?: number;
}

interface ProfileRow {
  balance_date: string;
  onboarded_at: string | null;
  onboarding_seconds: number | null;
}

export async function getProfileMeta(db: SqlDriver): Promise<ProfileMeta> {
  const row = await db.first<ProfileRow>('SELECT balance_date, onboarded_at, onboarding_seconds FROM profile WHERE id = 1');
  if (!row) throw new Error('Profile row is missing; the database was not migrated');
  return {
    balanceDate: row.balance_date,
    onboardedAt: row.onboarded_at ?? undefined,
    onboardingSeconds: row.onboarding_seconds ?? undefined,
  };
}

export const setBalanceDate = (db: SqlDriver, date: string) => db.run('UPDATE profile SET balance_date = ? WHERE id = 1', [date]);

export const setOnboarded = (db: SqlDriver, at: string, seconds: number) =>
  db.run('UPDATE profile SET onboarded_at = ?, onboarding_seconds = ? WHERE id = 1', [at, Math.round(seconds)]);
