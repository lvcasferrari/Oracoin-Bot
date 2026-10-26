import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMETERS, PARAM_KEYS, cents, type Profile } from '../engine';
import { sampleProfile } from '../data/sample';
import { loadProfile, saveProfile } from './loadProfile';
import { toCents } from './mappers';
import { migrate, MIGRATIONS, type Migration } from './migrations';
import { nodeDriver } from './nodeDriver';
import { listInvoices, listParameters, replaceCardInstallments, saveCard, saveEntry, saveInvoice, saveParameter, USER_SOURCE } from './repos';
import { resetAll } from './reset';

const fresh = async () => {
  const db = nodeDriver();
  await migrate(db);
  return db;
};
const version = async (db: Awaited<ReturnType<typeof fresh>>) =>
  (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version;
const count = async (db: Awaited<ReturnType<typeof fresh>>, table: string) =>
  (await db.first<{ n: number }>(`SELECT count(*) AS n FROM ${table}`))?.n;

const fullProfile: Profile = {
  ...sampleProfile,
  invoices: [{ id: 'inv-nu-11', cardId: 'nu', dueMonth: '2026-11', amount: 2000, origin: 'confirmada', status: 'parcial', paidAmount: 500, partialPlanMonths: 6, estimatedAtConfirm: 1950 }],
  debts: [{ id: 'carro', name: 'Carro', kind: 'financiamento', principal: 12000, monthlyRate: 0.0149, months: 24, system: 'price', startMonth: '2026-12', dueDay: 15 }],
  goals: [{ id: 'reserva', name: 'Reserva', target: 18000, saved: 2500, deadline: '2027-12-31', priority: 1 }],
};

describe('migrations', () => {
  it('brings a fresh database to the latest version with a profile row', async () => {
    const db = await fresh();
    expect(await version(db)).toBe(MIGRATIONS.length);
    expect(await count(db, 'profile')).toBe(1);
  });
  it('is a no-op when run twice', async () => {
    const db = await fresh();
    await saveCard(db, sampleProfile.cards[0]);
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await count(db, 'cards')).toBe(1);
  });
  it('has contiguous versions 1..N', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });
  it('keeps existing rows when a later migration runs', async () => {
    const db = await fresh();
    await saveCard(db, sampleProfile.cards[0]);
    const v2: Migration = { version: MIGRATIONS.length + 1, sql: 'ALTER TABLE cards ADD COLUMN color TEXT;' };
    await migrate(db, [...MIGRATIONS, v2]);
    expect(await count(db, 'cards')).toBe(1);
    expect(await version(db)).toBe(v2.version);
  });
  it('leaves version and tables untouched when a migration fails', async () => {
    const db = await fresh();
    const broken: Migration = { version: MIGRATIONS.length + 1, sql: 'CREATE TABLE t2 (x); INSERT INTO nope VALUES (1);' };
    await expect(migrate(db, [...MIGRATIONS, broken])).rejects.toThrow();
    expect(await version(db)).toBe(MIGRATIONS.length);
    expect(await db.first("SELECT name FROM sqlite_master WHERE name = 't2'")).toBeNull();
  });
});

describe('parameter seed', () => {
  it('seeds every parameter key with the current defaults', async () => {
    const rows = await listParameters(await fresh());
    expect(new Set(rows.map((r) => r.key))).toEqual(new Set(PARAM_KEYS));
    for (const d of DEFAULT_PARAMETERS) {
      const latest = rows.filter((r) => r.key === d.key).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
      expect({ value: latest.value, effectiveFrom: latest.effectiveFrom, source: latest.source }).toEqual({
        value: d.value,
        effectiveFrom: d.effectiveFrom,
        source: d.source,
      });
    }
  });
  it('updates a same-day edit instead of failing', async () => {
    const db = await fresh();
    const edit = { key: 'projection_months' as const, value: 24, effectiveFrom: '2026-12-01', source: USER_SOURCE };
    await saveParameter(db, edit);
    await saveParameter(db, { ...edit, value: 30 });
    const rows = (await listParameters(db)).filter((r) => r.key === 'projection_months');
    expect(rows.map((r) => r.value)).toEqual([18, 30]);
  });
});

describe('round trip', () => {
  it('loads exactly what was saved, rounded to cents', async () => {
    const db = await fresh();
    await saveProfile(db, fullProfile);
    const loaded = await loadProfile(db);
    const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const key of ['accounts', 'cards', 'entries', 'installments', 'invoices', 'debts', 'goals'] as const) {
      expect(byId(loaded[key] as { id: string }[]), key).toEqual(byId(fullProfile[key] as { id: string }[]));
    }
    expect(loaded.balanceDate).toBe(fullProfile.balanceDate);
  });
  it('rounds amounts exactly like the engine does', async () => {
    const db = await fresh();
    await saveProfile(db, { ...fullProfile, accounts: [{ id: 'a', bank: 'X', kind: 'corrente', balance: 1234.565 }, { id: 'b', bank: 'Y', kind: 'corrente', balance: 0.1 + 0.2 }] });
    const balances = (await loadProfile(db)).accounts.map((a) => a.balance);
    expect(balances).toEqual([cents(1234.565), 0.3]);
  });
});

describe('constraints', () => {
  it('deleting a card removes its invoices and installments and frees its entries', async () => {
    const db = await fresh();
    await saveProfile(db, fullProfile);
    await saveEntry(db, { id: 'net', kind: 'out', name: 'Streaming', amount: 50, day: 20, recurrence: 'monthly', startMonth: '2026-11', cardId: 'nu' });
    await db.run('DELETE FROM cards WHERE id = ?', ['nu']);
    const p = await loadProfile(db);
    expect(p.invoices).toEqual([]);
    expect(p.installments.every((i) => i.cardId !== 'nu')).toBe(true);
    expect(p.entries.find((e) => e.id === 'net')?.cardId).toBeUndefined();
  });
  it('keeps one invoice per card and month (saving again updates it)', async () => {
    const db = await fresh();
    await saveProfile(db, fullProfile);
    await saveInvoice(db, { ...fullProfile.invoices[0], id: 'other-id', amount: 2100, status: 'fechada', paidAmount: undefined });
    const rows = await listInvoices(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'inv-nu-11', amount: 2100, status: 'fechada' });
  });
  it('re-saving a card never cascades away its invoices', async () => {
    const db = await fresh();
    await saveProfile(db, fullProfile);
    await saveCard(db, { ...fullProfile.cards[0], limit: 9000 });
    expect(await listInvoices(db)).toHaveLength(1);
  });
  it('rejects an income charged on a card', async () => {
    const db = await fresh();
    await saveCard(db, sampleProfile.cards[0]);
    await expect(
      saveEntry(db, { id: 'x', kind: 'in', name: 'Estorno', amount: 10, day: 1, recurrence: 'monthly', startMonth: '2026-11', cardId: 'nu' }),
    ).rejects.toThrow();
  });
  it('writes nothing when a transaction fails', async () => {
    const db = await fresh();
    await expect(
      db.transaction(async (tx) => {
        await saveCard(tx, sampleProfile.cards[0]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await count(db, 'cards')).toBe(0);
  });
});

describe('installments grid', () => {
  it('replaces only the edited months and keeps earlier ones', async () => {
    const db = await fresh();
    await saveProfile(db, fullProfile); // nu: 2026-11 and 2026-12
    await replaceCardInstallments(db, 'nu', '2026-12', [{ id: 'n1', cardId: 'nu', dueMonth: '2027-01', amount: 400 }]);
    const rows = (await loadProfile(db)).installments.filter((i) => i.cardId === 'nu');
    expect(rows.map((i) => [i.dueMonth, i.amount])).toEqual([['2026-11', 1200], ['2027-01', 400]]);
  });
  it('refuses rows outside the edited months', async () => {
    const db = await fresh();
    await expect(replaceCardInstallments(db, 'nu', '2026-12', [{ id: 'x', cardId: 'nu', dueMonth: '2026-11', amount: 1 }])).rejects.toThrow();
  });
});

describe('resetAll', () => {
  it('empties every table except the default parameters', async () => {
    const db = await fresh();
    await saveProfile(db, fullProfile);
    await saveParameter(db, { key: 'projection_months', value: 24, effectiveFrom: '2026-12-01', source: USER_SOURCE });
    await db.run("INSERT INTO score_history VALUES ('2026-11', 70, 80, 60, 100, 40)");
    await resetAll(db, '2026-12-02');

    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    for (const { name } of tables) {
      if (name === 'parameters' || name === 'profile') continue;
      expect(await count(db, name)).toBe(0);
    }
    const params = await listParameters(db);
    expect(params).toHaveLength(DEFAULT_PARAMETERS.length);
    expect(params.some((p) => p.source === USER_SOURCE)).toBe(false);
    const p = await loadProfile(db);
    expect(p.balanceDate).toBe('2026-12-02');
    expect(p.cards).toEqual([]);
  });
});

describe('mappers', () => {
  it('reject non-finite and absurd amounts', () => {
    expect(() => toCents(NaN)).toThrow(RangeError);
    expect(() => toCents(Infinity)).toThrow(RangeError);
    expect(() => toCents(2e9)).toThrow(RangeError);
  });
});
