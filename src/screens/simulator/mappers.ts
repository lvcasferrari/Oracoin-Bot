// Pure: simulator form text → ScenarioChange. No react-native imports (tested in Vitest).
import { addMonths, cents, monthOf, type Card, type Installment, type ScenarioChange, type ScenarioRows } from '../../engine';
import { formatDateBR, parseDateBR, parseDay, parseMonthBR, shortMonth } from '../../lib/dateInput';
import { formatBRL, parseBRL } from '../../lib/money';
import { MSG, type Result } from '../forms/mappers';

export type SimType = 'purchase' | 'financing' | 'mortgage' | 'subscription' | 'incomeDrop' | 'costUp' | 'emergency' | 'payPartial';

export const SIM_TYPES: { type: SimType; title: string; hint: string }[] = [
  { type: 'purchase', title: 'Comprar parcelado', hint: 'Fatura de cada mês e limite' },
  { type: 'payPartial', title: 'Minha fatura é maior que o que eu recebo', hint: 'Pior caso, com teto' },
  { type: 'financing', title: 'Financiar', hint: 'Parcela e custo total' },
  { type: 'mortgage', title: 'Imóvel', hint: 'Parcela e teste com renda menor' },
  { type: 'subscription', title: 'Nova assinatura', hint: 'Liberdade mensal perdida' },
  { type: 'incomeDrop', title: 'Renda cair', hint: 'Quantos meses o colchão aguenta' },
  { type: 'costUp', title: 'Custo de vida subir', hint: 'Sobra que resta' },
  { type: 'emergency', title: 'Imprevisto', hint: 'Quanto tempo a reserva cobre' },
];

export type SimDraft = Record<string, string>;

/** Starting values for each form (dates and months relative to today). */
export function defaultDraft(type: SimType, ctx: { today: string; cardId?: string; partialMonths: number }): SimDraft {
  const next = addMonths(monthOf(ctx.today), 1);
  const nextBR = `${next.slice(5)}/${next.slice(0, 4)}`;
  switch (type) {
    case 'purchase':
      return { cardId: ctx.cardId ?? '', total: '', installments: '10', ratePct: '' };
    case 'payPartial':
      return { cardId: ctx.cardId ?? '', payNow: '', months: String(ctx.partialMonths) };
    case 'financing':
      return { name: 'Carro', price: '', downPayment: '', ratePct: '', months: '48', system: 'price', dueDay: '10', startMonth: nextBR };
    case 'mortgage':
      return { name: 'Imóvel', price: '', downPayment: '', ratePct: '', months: '360', system: 'sac', dueDay: '10', startMonth: nextBR, stressPct: '20' };
    case 'subscription':
      return { name: '', amount: '', day: '10', cardId: '' };
    case 'incomeDrop':
      return { pct: '30', months: '3', startMonth: nextBR };
    case 'costUp':
      return { amount: '', startMonth: nextBR };
    case 'emergency':
      return { amount: '', date: `${ctx.today.slice(8)}/${ctx.today.slice(5, 7)}/${ctx.today.slice(0, 4)}` };
  }
}

const int = (text: string, min: number, max: number): number | null => {
  if (!/^\s*\d+\s*$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
};

const pct = (text: string, max: number): number | null => {
  if (text.trim() === '') return null;
  const value = parseBRL(text.replace('%', ''));
  // Percent typed with up to 2 decimals; round so 0,9% is exactly 0.009.
  return value !== null && value <= max ? Math.round(value * 1e4) / 1e6 : null;
};

/** Plain-language list of exactly what "Seguir com isso" writes (shown before confirming). */
export function describeRows(rows: ScenarioRows, cards: Card[]): string[] {
  const cardName = (id?: string) => {
    const c = cards.find((x) => x.id === id);
    return c ? c.bank : 'cartão';
  };
  const lines: string[] = [];
  for (const e of rows.entries) {
    const sign = e.kind === 'in' ? 'Entrada' : 'Saída';
    const when =
      e.recurrence === 'once'
        ? `em ${formatDateBR(e.date ?? '')}`
        : `todo ${e.recurrence === 'yearly' ? 'ano' : 'mês'}, dia ${e.day}, de ${shortMonth(e.startMonth)}${e.endMonth ? ` a ${shortMonth(e.endMonth)}` : ' em diante'}`;
    lines.push(`${sign} "${e.name}": ${formatBRL(e.amount)} ${when}${e.cardId ? ` (no cartão ${cardName(e.cardId)})` : ''}`);
  }
  const byCard = new Map<string, Installment[]>();
  for (const i of rows.installments) byCard.set(i.cardId, [...(byCard.get(i.cardId) ?? []), i]);
  for (const [cardId, list] of byCard) {
    const sorted = [...list].sort((a, b) => (a.dueMonth < b.dueMonth ? -1 : 1));
    const total = sorted.reduce((s, i) => s + i.amount, 0);
    lines.push(`${sorted.length} parcelas no ${cardName(cardId)}, de ${shortMonth(sorted[0].dueMonth)} a ${shortMonth(sorted[sorted.length - 1].dueMonth)}: ${formatBRL(cents(total))} no total`);
  }
  for (const d of rows.debts) lines.push(`Dívida "${d.name}": ${formatBRL(d.principal)} em ${d.months} parcelas a partir de ${shortMonth(d.startMonth)}`);
  for (const i of rows.invoices) {
    lines.push(
      i.status === 'parcial'
        ? `Fatura ${cardName(i.cardId)} de ${shortMonth(i.dueMonth)}: pagamento parcial de ${formatBRL(i.paidAmount ?? 0)}, restante em ${i.partialPlanMonths} parcelas`
        : `Fatura ${cardName(i.cardId)} de ${shortMonth(i.dueMonth)}: paga`,
    );
  }
  return lines;
}

/** Builds the change for one simulator type; `dueMonthFor` gives the card's next invoice month. */
export function changeFromDraft(type: SimType, d: SimDraft, ctx: { dueMonthFor: (cardId: string) => string }): Result<ScenarioChange> {
  const errors: Record<string, string> = {};
  const money = (field: string, opts: { positive?: boolean; optional?: boolean } = {}): number => {
    const text = d[field] ?? '';
    if (text.trim() === '') {
      if (!opts.optional) errors[field] = MSG.required;
      return 0;
    }
    const value = parseBRL(text);
    if (value === null) errors[field] = MSG.money;
    else if (opts.positive && value <= 0) errors[field] = MSG.positive;
    return value ?? 0;
  };
  const fail = (): Result<ScenarioChange> => ({ ok: false, errors });

  switch (type) {
    case 'purchase': {
      const total = money('total', { positive: true });
      const n = int(d.installments ?? '', 1, 48);
      if (n === null) errors.installments = 'Use de 1 a 48 parcelas.';
      const rate = d.ratePct?.trim() ? pct(d.ratePct, 100) : 0;
      if (rate === null) errors.ratePct = MSG.rate;
      if (!d.cardId) errors.cardId = MSG.required;
      if (Object.keys(errors).length) return fail();
      return { ok: true, value: { type: 'purchase', cardId: d.cardId, total, installments: n as number, interestMonthly: rate || undefined } };
    }
    case 'payPartial': {
      const payNow = money('payNow', { optional: true });
      const months = int(d.months ?? '', 1, 24);
      if (months === null) errors.months = 'Use de 1 a 24 parcelas.';
      if (!d.cardId) errors.cardId = MSG.required;
      if (Object.keys(errors).length) return fail();
      return { ok: true, value: { type: 'payPartial', cardId: d.cardId, dueMonth: ctx.dueMonthFor(d.cardId), payNow, months: months as number } };
    }
    case 'financing':
    case 'mortgage': {
      const price = money('price', { positive: true });
      const downPayment = money('downPayment', { optional: true });
      if (downPayment > price) errors.downPayment = 'A entrada não pode passar do valor.';
      const rate = pct(d.ratePct ?? '', 100);
      if (rate === null) errors.ratePct = MSG.rate;
      const months = int(d.months ?? '', 1, 600);
      if (months === null) errors.months = MSG.months;
      const dueDay = parseDay(d.dueDay ?? '');
      if (dueDay === null) errors.dueDay = MSG.day;
      const startMonth = parseMonthBR(d.startMonth ?? '');
      if (!startMonth) errors.startMonth = MSG.month;
      const stress = type === 'mortgage' ? pct(d.stressPct ?? '0', 90) : 0;
      if (stress === null) errors.stressPct = 'Use de 0 a 90%.';
      if (Object.keys(errors).length) return fail();
      return {
        ok: true,
        value: {
          type: 'debt',
          downPayment,
          incomeStressPct: stress || undefined,
          debt: {
            name: (d.name ?? '').trim() || (type === 'mortgage' ? 'Imóvel' : 'Financiamento'),
            kind: type === 'mortgage' ? 'hipoteca' : 'financiamento',
            principal: price,
            monthlyRate: rate as number,
            months: months as number,
            system: d.system === 'sac' ? 'sac' : 'price',
            startMonth: startMonth as string,
            dueDay: dueDay as number,
          },
        },
      };
    }
    case 'subscription': {
      const amount = money('amount', { positive: true });
      const day = parseDay(d.day ?? '');
      if (day === null) errors.day = MSG.day;
      if (Object.keys(errors).length) return fail();
      return { ok: true, value: { type: 'subscription', name: (d.name ?? '').trim() || undefined, amount, day: day as number, cardId: d.cardId || undefined } };
    }
    case 'incomeDrop': {
      const drop = pct(d.pct ?? '', 100);
      if (drop === null || drop <= 0) errors.pct = 'Use de 1 a 100%.';
      const months = int(d.months ?? '', 1, 60);
      if (months === null) errors.months = 'Use de 1 a 60 meses.';
      const startMonth = parseMonthBR(d.startMonth ?? '');
      if (!startMonth) errors.startMonth = MSG.month;
      if (Object.keys(errors).length) return fail();
      return { ok: true, value: { type: 'incomeChange', deltaPct: -(drop as number), months: months as number, startMonth: startMonth as string } };
    }
    case 'costUp': {
      const amount = money('amount', { positive: true });
      const startMonth = parseMonthBR(d.startMonth ?? '');
      if (!startMonth) errors.startMonth = MSG.month;
      if (Object.keys(errors).length) return fail();
      return { ok: true, value: { type: 'costChange', amount, startMonth: startMonth as string } };
    }
    case 'emergency': {
      const amount = money('amount', { positive: true });
      const date = parseDateBR(d.date ?? '');
      if (!date) errors.date = MSG.date;
      if (Object.keys(errors).length) return fail();
      return { ok: true, value: { type: 'emergency', amount, date: date as string } };
    }
  }
}
