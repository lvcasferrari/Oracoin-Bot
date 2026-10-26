import type { SqlDriver } from '../db/driver';
import { saveProfile } from '../db/loadProfile';
import { makeSample } from './sample';

/** Dev only: fills the repository with the example profile. */
export const loadSample = (db: SqlDriver, today: string): Promise<void> => saveProfile(db, makeSample(today));
