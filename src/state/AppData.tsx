import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { todayLocal, type Profile } from '../engine';
import type { SqlDriver } from '../db/driver';
import { loadProfile } from '../db/loadProfile';
import { openDb } from '../db/open';
import { getProfileMeta, type ProfileMeta } from '../db/repos/profileMeta';
import { logError } from '../lib/log';

type Status = 'loading' | 'ready' | 'error';

interface AppDataValue {
  status: Status;
  db: SqlDriver | null;
  profile: Profile | null;
  meta: ProfileMeta | null;
  today: string;
  /** Reloads the profile after a write. */
  refresh: () => Promise<void>;
  /** Tries to open the database again after an error. Never deletes anything. */
  retry: () => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [db, setDb] = useState<SqlDriver | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meta, setMeta] = useState<ProfileMeta | null>(null);
  const [today, setToday] = useState(todayLocal());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    (async () => {
      const opened = await openDb();
      const loaded = await loadProfile(opened);
      const loadedMeta = await getProfileMeta(opened);
      if (!alive) return;
      setDb(opened);
      setProfile(loaded);
      setMeta(loadedMeta);
      setStatus('ready');
    })().catch((error: unknown) => {
      logError('[AppData] could not open the database', error);
      if (alive) setStatus('error');
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  // "Today" changes when the app comes back after midnight.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(todayLocal());
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(async () => {
    if (!db) return;
    setProfile(await loadProfile(db));
    setMeta(await getProfileMeta(db));
  }, [db]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(() => ({ status, db, profile, meta, today, refresh, retry }), [status, db, profile, meta, today, refresh, retry]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}

/** For screens rendered behind DataGate, where the data is always loaded. */
export function useReadyData() {
  const { status, db, profile, meta, today, refresh } = useAppData();
  if (status !== 'ready' || !db || !profile || !meta) throw new Error('useReadyData used before the data was ready');
  return { db, profile, meta, today, refresh };
}

export const isEmptyProfile = (p: Profile): boolean => p.entries.length === 0 && p.cards.length === 0 && p.accounts.length === 0;
