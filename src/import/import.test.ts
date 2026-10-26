import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildEvents, DEFAULT_PARAMETERS, type Profile } from '../engine';
import { loadProfile } from '../db/loadProfile';
import { migrate } from '../db/migrations';
import { nodeDriver } from '../db/nodeDriver';
import { listScenarios, saveCard, saveEntry } from '../db/repos';
import { commitImport } from './commit';
import { checkFile, countDuplicates, countNew, mapWorkbook } from './mapWorkbook';
import { SAMPLE_SHEETS, type Sheets } from './sampleWorkbook';
import { sheetsToWorkbook, workbookToSheets } from './xlsx';

const TODAY = '2026-11-01';
const empty: Profile = { accounts: [], balanceDate: TODAY, entries: [], cards: [], installments: [], invoices: [], debts: [], goals: [], parameters: DEFAULT_PARAMETERS };
const ids = () => {
  let n = 0;
  return (prefix: string) => `${prefix}-${n++}`;
};
const map = (sheets: Sheets, existing: Profile = empty) => mapWorkbook(sheets, { today: TODAY, makeId: ids(), existing });

describe('mapWorkbook (dummy example spreadsheet)', () => {
  const p = map(SAMPLE_SHEETS);

  it('reads every tab with no warnings', () => {
    expect(p.warnings).toEqual([]);
    expect([p.accounts, p.cards, p.entries, p.installments, p.debts, p.scenarios].map((r) => r.length)).toEqual([2, 2, 10, 5, 3, 5]);
  });
  it('maps entries: card charges, yearly and one-off items, categories and pt-BR amounts', () => {
    const nubank = p.cards.find((c) => c.value.bank === 'Nubank')?.value;
    const entry = (name: string) => p.entries.find((e) => e.value.name === name)?.value;
    expect(entry('Streaming')).toMatchObject({ kind: 'out', amount: 55.9, cardId: nubank?.id, category: 'lazer' });
    expect(entry('IPVA')).toMatchObject({ recurrence: 'yearly', startMonth: '2027-03', day: 15 });
    expect(entry('Seguro do carro')).toMatchObject({ recurrence: 'once', date: '2027-01-25' });
    expect(entry('Freela de design')).toMatchObject({ kind: 'in', endMonth: '2027-06' });
  });
  it('maps debts by tab with the rate as a monthly fraction', () => {
    expect(p.debts.map((d) => [d.value.kind, d.value.monthlyRate, d.value.system])).toEqual([
      ['hipoteca', 0.0085, 'sac'],
      ['emprestimo', 0.029, 'price'],
      ['financiamento', 0.0149, 'price'],
    ]);
  });
  it('maps scenarios into simulator changes', () => {
    expect(p.scenarios.map((s) => s.value.changes[0].type)).toEqual(['purchase', 'subscription', 'incomeChange', 'costChange', 'emergency']);
    expect(p.scenarios[2].value.changes[0]).toMatchObject({ deltaPct: -0.2, months: 3, startMonth: '2027-01' });
    expect(p.scenarios[4].value.changes[0]).toMatchObject({ amount: 2500, date: '2027-02-15' });
  });
  it('gives the same result after a real .xlsx write and read', () => {
    const buffer = XLSX.write(sheetsToWorkbook(SAMPLE_SHEETS), { type: 'buffer', bookType: 'xlsx' });
    const roundTrip = map(workbookToSheets(XLSX.read(buffer, { type: 'buffer', cellDates: true })));
    expect(roundTrip).toEqual(p);
  });
  it('matches the example file shipped in assets/examples', () => {
    const file = join(__dirname, '../../assets/examples/life-strategic-plan-exemplo.xlsx');
    expect(existsSync(file)).toBe(true);
    const fromFile = map(workbookToSheets(XLSX.read(readFileSync(file), { type: 'buffer', cellDates: true })));
    expect(fromFile).toEqual(p);
  });
  it('accepts real spreadsheet dates in month columns', () => {
    const sheets: Sheets = { Parcelas: [['Cartão', 'Mês', 'Valor'], ['Nubank Roxinho', new Date(2026, 11, 1), 100]], Cartões: SAMPLE_SHEETS['Cartões'] };
    expect(map(sheets).installments[0].value.dueMonth).toBe('2026-12');
  });
});

describe('warnings (nothing is dropped silently)', () => {
  it('reports unknown tabs, unknown columns and invalid rows with their line', () => {
    const p = map({
      Investimentos: [['Ativo'], ['Tesouro']],
      Painel: [
        ['Tipo', 'Nome', 'Valor', 'Dia', 'Repete', 'Início', 'Observação'],
        ['Saída', 'Luz', 'abc', 10, 'Mensal', '01/2026', 'x'],
        ['Saída', 'Água', 90, 10, 'Mensal', '01/2026', ''],
      ],
    });
    expect(p.warnings).toEqual([
      'A aba "Investimentos" não é usada pelo app e foi ignorada.',
      'A coluna "Observação" da aba "Painel" foi ignorada.',
      'Aba Painel, linha 2: valor inválido. A linha foi ignorada.',
    ]);
    expect(p.entries.map((e) => e.value.name)).toEqual(['Água']);
  });
  it('keeps an entry whose card is unknown, paid from the account, with a warning', () => {
    const p = map({ Painel: [['Tipo', 'Nome', 'Valor', 'Dia', 'Cartão'], ['Saída', 'Jornal', 30, 5, 'Banco X']] });
    expect(p.entries[0].value.cardId).toBeUndefined();
    expect(p.warnings[0]).toMatch(/cartão "Banco X" não encontrado/);
  });
});

describe('duplicates and commit', () => {
  it('flags items already in the app and reuses their ids', () => {
    const existing: Profile = {
      ...empty,
      cards: [{ id: 'old-nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 1, variableEstimate: 0 }],
      entries: [{ id: 'old-rent', kind: 'out', name: 'aluguel', amount: 1, day: 1, recurrence: 'monthly', startMonth: '2026-01' }],
    };
    const p = map(SAMPLE_SHEETS, existing);
    expect(p.cards.find((c) => c.value.bank === 'Nubank')).toMatchObject({ duplicate: true, value: { id: 'old-nu' } });
    expect(p.entries.find((e) => e.value.name === 'Aluguel')).toMatchObject({ duplicate: true, value: { id: 'old-rent' } });
    expect(p.installments.filter((i) => i.value.cardId === 'old-nu')).toHaveLength(3);
    expect(countDuplicates(p)).toBe(2);
    expect(countNew(p)).toBe(25);
  });
  it('writes everything in one transaction, with a usable projection afterwards', async () => {
    const db = nodeDriver();
    await migrate(db);
    const p = map(SAMPLE_SHEETS, await loadProfile(db));
    expect(await commitImport(db, p, 'skip', TODAY)).toBe(27);
    const profile = await loadProfile(db);
    expect(profile.balanceDate).toBe(TODAY);
    expect(profile.accounts.reduce((s, a) => s + a.balance, 0)).toBe(12200);
    expect(await listScenarios(db)).toHaveLength(5);
    expect(buildEvents(profile, TODAY).length).toBeGreaterThan(50);
  });
  it('skips or replaces duplicates as chosen', async () => {
    const db = nodeDriver();
    await migrate(db);
    await saveEntry(db, { id: 'rent', kind: 'out', name: 'Aluguel', amount: 1000, day: 10, recurrence: 'monthly', startMonth: '2026-01' });
    const rent = async () => (await loadProfile(db)).entries.find((e) => e.name === 'Aluguel')?.amount;
    await commitImport(db, map(SAMPLE_SHEETS, await loadProfile(db)), 'skip', TODAY);
    expect(await rent()).toBe(1000);
    await commitImport(db, map(SAMPLE_SHEETS, await loadProfile(db)), 'replace', TODAY);
    expect(await rent()).toBe(2300);
    expect((await loadProfile(db)).entries.filter((e) => e.name === 'Aluguel')).toHaveLength(1);
  });
  it('writes nothing when any row fails', async () => {
    const db = nodeDriver();
    await migrate(db);
    await saveCard(db, { id: 'c', bank: 'X', name: 'X', closingDay: 1, dueDay: 2, limit: 1, variableEstimate: 0 });
    const p = map(SAMPLE_SHEETS, await loadProfile(db));
    p.installments.push({ value: { id: 'bad', cardId: 'no-such-card', dueMonth: '2026-12', amount: 1 }, duplicate: false });
    await expect(commitImport(db, p, 'skip', TODAY)).rejects.toThrow();
    const after = await loadProfile(db);
    expect(after.entries).toEqual([]);
    expect(after.cards).toHaveLength(1);
  });
});

describe('checkFile', () => {
  it('accepts .xlsx up to 5 MB and explains anything else calmly', () => {
    expect(checkFile({ name: 'minha planilha.XLSX', size: 1000 })).toBeNull();
    expect(checkFile({ name: 'planilha.xls', size: 1000 })).toMatch(/\.xlsx/);
    expect(checkFile({ name: 'planilha.xlsx', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});
