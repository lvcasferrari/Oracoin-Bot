// Pure: spreadsheet rows → repository rows, with a warning for everything that is not used.
// Nothing is dropped silently (plan step 14).
import { cents, dateInMonth, monthOf, type Account, type Card, type Category, type Debt, type Entry, type Installment, type Profile, type Scenario, type ScenarioChange } from '../engine';
import { CATEGORY_LABELS } from '../lib/banks';
import { parseMonthBR } from '../lib/dateInput';
import { parseBRL } from '../lib/money';
import type { Cell, Sheets } from './sampleWorkbook';

export interface Row<T> {
  value: T;
  /** Already in the app (same name and kind); replaced or skipped at import time. */
  duplicate: boolean;
}

export interface ImportPreview {
  accounts: Row<Account>[];
  cards: Row<Card>[];
  entries: Row<Entry>[];
  installments: Row<Installment>[];
  debts: Row<Debt>[];
  scenarios: Row<Scenario>[];
  warnings: string[];
}

/** Lower case, no accents, single spaces: header and tab matching ignore accents and case. */
export const norm = (value: Cell): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const TABS = {
  painel: ['painel', 'lancamentos', 'entradas e saidas'],
  contas: ['contas'],
  cartoes: ['cartoes'],
  parcelas: ['parcelas'],
  hipoteca: ['hipoteca'],
  emprestimo: ['emprestimo', 'emprestimos'],
  financiamento: ['financiamento', 'financiamentos'],
  cenarios: ['cenarios'],
  ignored: ['leia-me', 'leia me', 'instrucoes'],
} as const;
type Tab = keyof typeof TABS;

const COLUMNS: Record<Exclude<Tab, 'ignored'>, Record<string, string[]>> = {
  painel: { tipo: ['tipo'], nome: ['nome'], valor: ['valor'], dia: ['dia'], repete: ['repete', 'recorrencia'], inicio: ['inicio'], fim: ['fim'], categoria: ['categoria'], cartao: ['cartao'] },
  contas: { banco: ['banco'], tipo: ['tipo'], saldo: ['saldo'] },
  cartoes: { banco: ['banco'], apelido: ['apelido', 'nome'], limite: ['limite'], fechamento: ['fechamento'], vencimento: ['vencimento'], gasto: ['gasto medio', 'gasto variavel'] },
  parcelas: { cartao: ['cartao'], mes: ['mes'], valor: ['valor'] },
  hipoteca: DEBT_COLUMNS(),
  emprestimo: DEBT_COLUMNS(),
  financiamento: DEBT_COLUMNS(),
  cenarios: { nome: ['nome'], tipo: ['tipo'], valor: ['valor'], parcelas: ['parcelas'], cartao: ['cartao'], dia: ['dia'], meses: ['meses'], inicio: ['inicio'] },
};

function DEBT_COLUMNS(): Record<string, string[]> {
  return {
    nome: ['nome'],
    saldo: ['saldo devedor', 'saldo'],
    juros: ['juros a.m. (%)', 'juros a.m.', 'juros (%)', 'juros'],
    parcelas: ['parcelas restantes', 'parcelas'],
    sistema: ['sistema'],
    proxima: ['proxima parcela', 'inicio'],
    vencimento: ['vencimento', 'dia'],
  };
}

const tabOf = (name: string): Tab | null => {
  const n = norm(name);
  return (Object.keys(TABS) as Tab[]).find((t) => (TABS[t] as readonly string[]).includes(n)) ?? null;
};

const money = (cell: Cell): number | null => {
  if (typeof cell === 'number') return Number.isFinite(cell) && cell >= 0 && cell <= 1e9 ? cents(cell) : null;
  return typeof cell === 'string' ? parseBRL(cell) : null;
};
const int = (cell: Cell, min: number, max: number): number | null => {
  const n = typeof cell === 'number' ? cell : /^\s*\d+\s*$/.test(String(cell ?? '')) ? Number(cell) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const month = (cell: Cell): string | null => {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    // Spreadsheet dates come at local midnight; noon avoids a timezone shift into the previous day.
    const d = new Date(cell.getTime() + 12 * 3600 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const s = String(cell ?? '').trim();
  return /^\d{4}-\d{2}$/.test(s) ? s : parseMonthBR(s);
};
const percent = (cell: Cell): number | null => {
  const v = money(typeof cell === 'string' ? cell.replace('%', '') : cell);
  return v !== null && v <= 100 ? Math.round(v * 1e4) / 1e6 : null;
};
const isEmptyRow = (row: Cell[]) => row.every((c) => String(c ?? '').trim() === '');

const CATEGORY_BY_LABEL: Record<string, Category> = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [norm(label), key as Category]),
);

/**
 * Maps a workbook to repository rows. `existing` is the current profile: matching items reuse
 * their id (so replacing overwrites and references stay valid) and are flagged as duplicates.
 */
export function mapWorkbook(sheets: Sheets, ctx: { today: string; makeId: (prefix: string) => string; existing: Profile }): ImportPreview {
  const out: ImportPreview = { accounts: [], cards: [], entries: [], installments: [], debts: [], scenarios: [], warnings: [] };
  const warn = (message: string) => out.warnings.push(message);
  const { existing } = ctx;

  // Read every known tab into header-keyed records; report unknown tabs and columns.
  const records: Partial<Record<Tab, { line: number; get: (field: string) => Cell }[]>> = {};
  for (const [name, rows] of Object.entries(sheets)) {
    const tab = tabOf(name);
    if (!tab) {
      warn(`A aba "${name}" não é usada pelo app e foi ignorada.`);
      continue;
    }
    if (tab === 'ignored' || rows.length === 0) continue;
    const columns = COLUMNS[tab];
    const header = rows[0].map(norm);
    const index: Record<string, number> = {};
    header.forEach((h, i) => {
      if (!h) return;
      const field = Object.keys(columns).find((f) => columns[f].includes(h));
      if (field) index[field] = i;
      else warn(`A coluna "${String(rows[0][i])}" da aba "${name}" foi ignorada.`);
    });
    records[tab] = rows
      .slice(1)
      .map((row, i) => ({ row, line: i + 2 }))
      .filter(({ row }) => !isEmptyRow(row))
      .map(({ row, line }) => ({ line, get: (field: string) => (index[field] === undefined ? undefined : row[index[field]]) }));
  }
  const skip = (tab: string, line: number, why: string) => warn(`Aba ${tab}, linha ${line}: ${why}. A linha foi ignorada.`);

  // Accounts
  for (const r of records.contas ?? []) {
    const bank = String(r.get('banco') ?? '').trim();
    const kindText = norm(r.get('tipo'));
    const kind: Account['kind'] = kindText.startsWith('poup') ? 'poupanca' : kindText.startsWith('cart') ? 'carteira' : 'corrente';
    const balance = String(r.get('saldo') ?? '').trim() === '' ? 0 : money(r.get('saldo'));
    if (!bank) skip('Contas', r.line, 'falta o banco');
    else if (balance === null) skip('Contas', r.line, 'saldo inválido');
    else {
      const match = existing.accounts.find((a) => norm(a.bank) === norm(bank) && a.kind === kind);
      out.accounts.push({ value: { id: match?.id ?? ctx.makeId('acc'), bank, kind, balance }, duplicate: Boolean(match) });
    }
  }

  // Cards (and a lookup by "Banco Apelido", apelido or banco for the other tabs)
  for (const r of records.cartoes ?? []) {
    const bank = String(r.get('banco') ?? '').trim();
    const name = String(r.get('apelido') ?? '').trim() || bank;
    const limit = money(r.get('limite'));
    const closingDay = int(r.get('fechamento'), 1, 31);
    const dueDay = int(r.get('vencimento'), 1, 31);
    const variable = String(r.get('gasto') ?? '').trim() === '' ? 0 : money(r.get('gasto'));
    if (!bank) skip('Cartões', r.line, 'falta o banco');
    else if (limit === null || limit <= 0) skip('Cartões', r.line, 'limite inválido');
    else if (closingDay === null || dueDay === null || closingDay === dueDay) skip('Cartões', r.line, 'fechamento e vencimento precisam ser dias diferentes de 1 a 31');
    else if (variable === null) skip('Cartões', r.line, 'gasto médio inválido');
    else {
      const match = existing.cards.find((c) => norm(c.bank) === norm(bank) && norm(c.name) === norm(name));
      out.cards.push({ value: { id: match?.id ?? ctx.makeId('card'), bank, name, limit, closingDay, dueDay, variableEstimate: variable }, duplicate: Boolean(match) });
    }
  }
  const allCards = [...out.cards.map((c) => c.value), ...existing.cards.filter((c) => !out.cards.some((o) => o.value.id === c.id))];
  const findCard = (cell: Cell): Card | undefined => {
    const n = norm(cell);
    if (!n) return undefined;
    return (
      allCards.find((c) => norm(`${c.bank} ${c.name}`) === n) ??
      allCards.find((c) => norm(c.name) === n) ??
      (allCards.filter((c) => norm(c.bank) === n).length === 1 ? allCards.find((c) => norm(c.bank) === n) : undefined)
    );
  };

  // Entries (Painel)
  for (const r of records.painel ?? []) {
    const kindText = norm(r.get('tipo'));
    const kind: Entry['kind'] | null = kindText.startsWith('entrada') ? 'in' : kindText.startsWith('saida') ? 'out' : null;
    const name = String(r.get('nome') ?? '').trim();
    const amount = money(r.get('valor'));
    const day = int(r.get('dia'), 1, 31);
    const rec = norm(r.get('repete'));
    const recurrence: Entry['recurrence'] | null = rec.startsWith('mensal') || rec === '' ? 'monthly' : rec.startsWith('anual') ? 'yearly' : rec.startsWith('unica') || rec === 'uma vez' ? 'once' : null;
    const start = month(r.get('inicio')) ?? (String(r.get('inicio') ?? '').trim() === '' ? monthOf(ctx.today) : null);
    const endText = String(r.get('fim') ?? '').trim();
    const end = endText ? month(r.get('fim')) : undefined;
    if (!kind) skip('Painel', r.line, 'o tipo precisa ser Entrada ou Saída');
    else if (!name) skip('Painel', r.line, 'falta o nome');
    else if (amount === null || amount <= 0) skip('Painel', r.line, 'valor inválido');
    else if (day === null) skip('Painel', r.line, 'o dia precisa ser de 1 a 31');
    else if (!recurrence) skip('Painel', r.line, '"Repete" precisa ser Mensal, Anual ou Única');
    else if (!start || end === null || (end && end < start)) skip('Painel', r.line, 'mês de início ou fim inválido (use mm/aaaa)');
    else {
      const categoryText = norm(r.get('categoria'));
      const category = categoryText ? CATEGORY_BY_LABEL[categoryText] : undefined;
      if (categoryText && !category) warn(`Aba Painel, linha ${r.line}: categoria "${String(r.get('categoria'))}" não existe no app; ficou sem categoria.`);
      let cardId: string | undefined;
      if (kind === 'out' && norm(r.get('cartao'))) {
        cardId = findCard(r.get('cartao'))?.id;
        if (!cardId) warn(`Aba Painel, linha ${r.line}: cartão "${String(r.get('cartao'))}" não encontrado; o valor vai sair da conta.`);
      }
      const match = existing.entries.find((e) => norm(e.name) === norm(name) && e.kind === kind);
      const base = { id: match?.id ?? ctx.makeId('entry'), kind, name, amount, day, recurrence, category, cardId };
      const value: Entry =
        recurrence === 'once'
          ? { ...base, startMonth: start, date: dateInMonth(start, day) }
          : { ...base, startMonth: start, endMonth: end || undefined };
      out.entries.push({ value, duplicate: Boolean(match) });
    }
  }

  // Installments (summed per card and month)
  for (const r of records.parcelas ?? []) {
    const card = findCard(r.get('cartao'));
    const due = month(r.get('mes'));
    const amount = money(r.get('valor'));
    if (!card) skip('Parcelas', r.line, `cartão "${String(r.get('cartao') ?? '')}" não encontrado`);
    else if (!due) skip('Parcelas', r.line, 'mês inválido (use mm/aaaa)');
    else if (amount === null || amount <= 0) skip('Parcelas', r.line, 'valor inválido');
    else {
      const same = out.installments.find((i) => i.value.cardId === card.id && i.value.dueMonth === due);
      if (same) {
        same.value.amount = cents(same.value.amount + amount);
        continue;
      }
      const match = existing.installments.find((i) => i.cardId === card.id && i.dueMonth === due);
      out.installments.push({ value: { id: match?.id ?? ctx.makeId('inst'), cardId: card.id, dueMonth: due, amount }, duplicate: Boolean(match) });
    }
  }

  // Debts
  for (const [tab, kind, label] of [
    ['hipoteca', 'hipoteca', 'Hipoteca'],
    ['emprestimo', 'emprestimo', 'Empréstimo'],
    ['financiamento', 'financiamento', 'Financiamento'],
  ] as const) {
    for (const r of records[tab] ?? []) {
      const name = String(r.get('nome') ?? '').trim() || label;
      const principal = money(r.get('saldo'));
      const rate = percent(r.get('juros'));
      const months = int(r.get('parcelas'), 1, 600);
      const systemText = norm(r.get('sistema'));
      const system: Debt['system'] | null = systemText === 'sac' ? 'sac' : systemText === 'price' || systemText === '' ? 'price' : null;
      const start = month(r.get('proxima'));
      const dueDay = int(r.get('vencimento'), 1, 31);
      if (principal === null || principal <= 0) skip(label, r.line, 'saldo devedor inválido');
      else if (rate === null) skip(label, r.line, 'juros inválidos (use % ao mês, ex.: 1,49)');
      else if (months === null) skip(label, r.line, 'parcelas restantes inválidas');
      else if (!system) skip(label, r.line, 'sistema precisa ser Price ou SAC');
      else if (!start || dueDay === null) skip(label, r.line, 'próxima parcela (mm/aaaa) ou vencimento inválido');
      else {
        const match = existing.debts.find((d) => norm(d.name) === norm(name));
        out.debts.push({ value: { id: match?.id ?? ctx.makeId('debt'), name, kind, principal, monthlyRate: rate, months, system, startMonth: start, dueDay }, duplicate: Boolean(match) });
      }
    }
  }

  // Scenarios
  for (const r of records.cenarios ?? []) {
    const name = String(r.get('nome') ?? '').trim();
    const type = norm(r.get('tipo'));
    const value = money(r.get('valor'));
    let change: ScenarioChange | null = null;
    let why = '';
    if (!name) why = 'falta o nome';
    else if (value === null || value <= 0) why = 'valor inválido';
    else if (type === 'compra parcelada') {
      const card = findCard(r.get('cartao'));
      const n = int(r.get('parcelas'), 1, 48);
      if (!card) why = 'cartão não encontrado';
      else if (n === null) why = 'parcelas inválidas';
      else change = { type: 'purchase', cardId: card.id, total: value, installments: n };
    } else if (type === 'assinatura') {
      const day = int(r.get('dia'), 1, 31);
      const card = norm(r.get('cartao')) ? findCard(r.get('cartao')) : undefined;
      if (day === null) why = 'dia inválido';
      else change = { type: 'subscription', name, amount: value, day, cardId: card?.id };
    } else if (type === 'renda cair') {
      const months = int(r.get('meses'), 1, 60);
      const start = month(r.get('inicio'));
      if (value > 100) why = 'a queda é em % (até 100)';
      else if (months === null || !start) why = 'meses ou início inválidos';
      else change = { type: 'incomeChange', deltaPct: -Math.round(value * 1e4) / 1e6, months, startMonth: start };
    } else if (type === 'custo de vida') {
      const start = month(r.get('inicio'));
      if (!start) why = 'início inválido';
      else change = { type: 'costChange', name, amount: value, startMonth: start };
    } else if (type === 'imprevisto') {
      const start = month(r.get('inicio'));
      const day = int(r.get('dia'), 1, 31) ?? 1;
      if (!start) why = 'início inválido';
      else change = { type: 'emergency', amount: value, date: dateInMonth(start, day) };
    } else {
      why = `tipo "${String(r.get('tipo') ?? '')}" não reconhecido (use Compra parcelada, Assinatura, Renda cair, Custo de vida ou Imprevisto)`;
    }
    if (!change) skip('Cenários', r.line, why);
    else out.scenarios.push({ value: { id: ctx.makeId('scn'), name, changes: [change] }, duplicate: false });
  }

  return out;
}

/** Calm checks before reading a file at all (plan step 14: local only, at most 5 MB, .xlsx). */
export function checkFile(file: { name: string; size?: number }): string | null {
  if (!/\.xlsx$/i.test(file.name)) return 'Use uma planilha no formato .xlsx.';
  if (file.size !== undefined && file.size > 5 * 1024 * 1024) return 'O arquivo passa de 5 MB. Use uma planilha menor.';
  return null;
}

export const countNew = (p: ImportPreview) =>
  [p.accounts, p.cards, p.entries, p.installments, p.debts, p.scenarios].reduce((s, rows) => s + rows.filter((r) => !r.duplicate).length, 0);
export const countDuplicates = (p: ImportPreview) =>
  [p.accounts, p.cards, p.entries, p.installments, p.debts, p.scenarios].reduce((s, rows) => s + rows.filter((r) => r.duplicate).length, 0);
