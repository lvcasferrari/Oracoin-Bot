import { describe, expect, it } from 'vitest';
import { loadProfile } from '../db/loadProfile';
import { migrate } from '../db/migrations';
import { nodeDriver } from '../db/nodeDriver';
import { loadSample } from './loadSample';

describe('loadSample', () => {
  it('writes the example profile anchored on today', async () => {
    const db = nodeDriver();
    await migrate(db);
    await loadSample(db, '2027-03-14');
    const p = await loadProfile(db);
    expect(p.balanceDate).toBe('2027-03-14');
    expect(p.cards.map((c) => c.id).sort()).toEqual(['itau', 'nu']);
    expect(p.installments.map((i) => i.dueMonth).sort()).toEqual(['2027-03', '2027-03', '2027-04']);
  });
});
