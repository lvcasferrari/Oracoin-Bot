import { addDays, addMonths, cents, dateInMonth, daysBetween, monthOf } from './dates';
import { closingDate, dueDate, invoiceMonthForCharge } from './cycle';
import { buildEvents, cashProjection, criticalDay, invoiceFor, profileBalance } from './events';
import { netIncome, payday } from './metrics';
import { param, paramRow } from './params';
import { worstCase } from './rotativo';
import { applyChanges, evaluate } from './scenarios';
import type { Invoice, Parameter, Profile, Scenario, ScenarioChange } from './types';

/** Spec 04 catalog numbers shipped in the MVP. */
export type ActionId = 1 | 2 | 3 | 6 | 8;

export interface Action {
  id: ActionId;
  title: string;
  message: string;
  /** "Por que você está vendo isto". */
  why: string;
  /** Card the action is about, when there is one. */
  cardId?: string;
  impact: {
    /** Lowest projected balance if the user takes the action (alerts always check cash, spec 04). */
    criticalBalanceAfter: number;
    /** Extra cost in reais (0 when the action costs nothing). */
    totalCost: number;
    monthsShift?: number;
  };
  assumptions: Parameter[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;
const lowest = (p: Profile, today: string): number => criticalDay(profileBalance(p), buildEvents(p, today))?.balance ?? profileBalance(p);

/** #1 Mover o vencimento para 3–5 dias depois do salário. */
function moveDueDate(base: Profile, today: string): Action[] {
  const pay = payday(base);
  if (pay === null) return [];
  const events = buildEvents(base, today);
  const points = cashProjection(profileBalance(base), events);
  const index = events.findIndex((e, i) => e.source === 'invoice' && points[i].balance < 0);
  if (index < 0) return [];
  const card = base.cards.find((c) => c.id === events[index].refId);
  if (!card || card.dueDay >= pay) return [];

  const before = lowest(base, today);
  let best: { day: number; low: number } | null = null;
  for (const offset of [3, 4, 5]) {
    const day = Math.min(28, pay + offset);
    if (day === card.closingDay) continue;
    const moved: Profile = { ...base, cards: base.cards.map((c) => (c.id === card.id ? { ...c, dueDay: day } : c)) };
    const low = lowest(moved, today);
    if (!best || low > best.low) best = { day, low };
  }
  if (!best || best.low <= before) return [];
  return [
    {
      id: 1,
      title: `Mover o vencimento do ${card.bank}`,
      cardId: card.id,
      message:
        `Mover o vencimento do ${card.bank} para o dia ${best.day} ` +
        (best.low >= 0 ? 'deixa o mês no azul.' : `melhora o dia mais crítico em ${brl(cents(best.low - before))}.`) +
        ' Dá para trocar no app do banco, sem custo.',
      why: `A fatura do ${card.bank} vence dia ${card.dueDay}, antes do salário (dia ${pay}), e o saldo previsto em ${ddmm(events[index].date)} fica em ${brl(points[index].balance)}. O fechamento costuma mudar junto com o vencimento (estimado).`,
      impact: { criticalBalanceAfter: best.low, totalCost: 0 },
      assumptions: [],
    },
  ];
}

/** #2 Melhor dia de compra: logo depois do fechamento, a compra cai na fatura seguinte. */
function bestPurchaseDay(profile: Profile, scenario: Scenario, today: string): Action[] {
  const purchase = scenario.changes.find((c): c is Extract<ScenarioChange, { type: 'purchase' }> => c.type === 'purchase');
  if (!purchase) return [];
  const card = profile.cards.find((c) => c.id === purchase.cardId);
  if (!card) return [];
  const date = purchase.date ?? today;
  const flag = paramRow(profile.parameters, 'purchase_on_closing_day_next_invoice', today);
  const first = invoiceMonthForCharge(card, date, profile.parameters, today);
  const closing = closingDate(card, first);
  const bestDate = flag.value >= 0.5 ? closing : addDays(closing, 1);
  if (bestDate <= date) return [];

  const nowFloat = daysBetween(date, dueDate(card, first));
  const laterFloat = daysBetween(bestDate, dueDate(card, addMonths(first, 1)));
  const low = lowest(applyChanges(profile, [{ ...purchase, date: bestDate }], today), today);
  return [
    {
      id: 2,
      title: 'Comprar logo depois do fechamento',
      cardId: card.id,
      message: `Comprando a partir de ${ddmm(bestDate)}, a primeira parcela vence em ${ddmm(dueDate(card, addMonths(first, 1)))}: ${laterFloat} dias até pagar, em vez de ${nowFloat}.`,
      why: `O ${card.bank} fecha a fatura no dia ${card.closingDay}. Estimado: a regra do banco pode variar.`,
      impact: { criticalBalanceAfter: low, totalCost: 0 },
      assumptions: [flag],
    },
  ];
}

/** #3 Pagar integral vs. parcial, when a due date's balance does not cover the invoice. */
function payInFullOrPart(base: Profile, today: string): Action[] {
  const events = buildEvents(base, today);
  const points = cashProjection(profileBalance(base), events);
  const index = events.findIndex((e, i) => e.source === 'invoice' && e.date >= today && points[i].balance < 0);
  if (index < 0) return [];
  const event = events[index];
  const card = base.cards.find((c) => c.id === event.refId);
  if (!card) return [];
  const dueMonth = monthOf(event.date);
  const invoice = -event.amount;
  const shortfall = cents(-points[index].balance);
  const payNow = cents(Math.max(0, invoice - shortfall));
  const months = param(base.parameters, 'partial_plan_default_months', today);
  const plan = worstCase(cents(invoice - payNow), months, base.parameters, today);
  const low = lowest(applyChanges(base, [{ type: 'payPartial', cardId: card.id, dueMonth, payNow, months }], today), today);
  return [
    {
      id: 3,
      title: 'Pagar o que cabe e parcelar o resto',
      cardId: card.id,
      message:
        `Em ${ddmm(event.date)}, pagar a fatura do ${card.bank} inteira (${brl(invoice)}) deixaria faltar ${brl(shortfall)}. ` +
        `Pagar ${brl(payNow)} e parcelar o resto em ${months}x custa até ${brl(plan.totalCharges)} em encargos (pior caso, com teto).`,
      why: `O saldo previsto não cobre a fatura no vencimento. O custo usa as premissas de juros e o teto legal de encargos.`,
      impact: { criticalBalanceAfter: low, totalCost: plan.totalCharges },
      assumptions: plan.assumptions,
    },
  ];
}

/** #6 Teto de fatura do mês: invoices above the orange band of income. */
function invoiceCeiling(base: Profile, today: string): Action[] {
  const month = addMonths(monthOf(today), 1);
  const income = netIncome(base, month, today);
  const orange = paramRow(base.parameters, 'commitment_band_orange', today);
  if (income <= 0 || base.cards.length === 0) return [];
  const views = base.cards.map((card) => ({ card, view: invoiceFor(base, card, month, today) }));
  const total = cents(views.reduce((s, v) => s + v.view.total, 0));
  const ceiling = cents(orange.value * income);
  if (total <= ceiling) return [];

  // Scale only this month's open invoices down to the ceiling (as user estimates) to measure the effect.
  const factor = ceiling / total;
  const capped: Invoice[] = views
    .filter((v) => !v.view.row || v.view.row.origin !== 'confirmada')
    .map((v) => ({ id: `teto-${v.card.id}`, cardId: v.card.id, dueMonth: month, amount: cents(v.view.total * factor), origin: 'estimada', status: 'fechada' }));
  const withCeiling: Profile = { ...base, invoices: [...base.invoices.filter((i) => !(i.dueMonth === month && capped.some((c) => c.cardId === i.cardId))), ...capped] };
  const committed = cents(views.reduce((s, v) => s + v.view.total - v.card.variableEstimate, 0));
  const room = cents(ceiling - committed);
  return [
    {
      id: 6,
      title: `Teto para as faturas de ${month.slice(5)}/${month.slice(0, 4)}`,
      message:
        `Um teto de ${brl(ceiling)} (${Math.round(orange.value * 100)}% da renda) deixa o mês mais leve. A previsão hoje é ${brl(total)}. ` +
        (room > 0 ? `Cabem mais ${brl(room)} em compras novas até o fechamento.` : 'As parcelas já ocupam o teto; vale segurar compras novas no cartão até o fechamento.'),
      why: `Faturas acima de ${Math.round(orange.value * 100)}% da renda costumam apertar o mês (referência do app, editável em Plano).`,
      impact: { criticalBalanceAfter: lowest(withCeiling, today), totalCost: 0 },
      assumptions: [orange],
    },
  ];
}

/** #8 Adiar a compra N meses until the scenario becomes comfortable. */
function postponePurchase(profile: Profile, scenario: Scenario, today: string): Action[] {
  const purchase = scenario.changes.find((c): c is Extract<ScenarioChange, { type: 'purchase' }> => c.type === 'purchase');
  if (!purchase) return [];
  if (evaluate(profile, scenario, today).verdict === 'confortavel') return [];
  const date = purchase.date ?? today;
  for (let n = 1; n <= 6; n++) {
    const later = dateInMonth(addMonths(monthOf(date), n), Number(date.slice(8)));
    const shifted: Scenario = { ...scenario, changes: scenario.changes.map((c) => (c === purchase ? { ...purchase, date: later } : c)) };
    const result = evaluate(profile, shifted, today);
    if (result.verdict === 'confortavel') {
      return [
        {
          id: 8,
          title: 'Esperar um pouco para comprar',
          cardId: purchase.cardId,
          message: `Se esperar ${n} ${n === 1 ? 'mês' : 'meses'}, o cenário fica confortável.`,
          why: 'Com a compra agora, o saldo previsto fica apertado em algum mês. Mais adiante, parcelas atuais terminam ou a sobra acumula.',
          impact: { criticalBalanceAfter: result.result.critical?.balance ?? profileBalance(profile), totalCost: 0, monthsShift: n },
          assumptions: result.assumptions,
        },
      ];
    }
  }
  return [];
}

/**
 * Up to three concrete actions with calculated cost (spec 01 principle 3, spec 04 catalog).
 * Never suggests taking credit (spec 06 rule 2).
 */
export function suggestActions(profile: Profile, scenario: Scenario | null, today: string): Action[] {
  const base = scenario ? applyChanges(profile, scenario.changes, today) : profile;
  const actions = [
    ...moveDueDate(base, today),
    ...(scenario ? bestPurchaseDay(profile, scenario, today) : []),
    ...payInFullOrPart(base, today),
    ...invoiceCeiling(base, today),
    ...(scenario ? postponePurchase(profile, scenario, today) : []),
  ];
  return actions
    .sort((a, b) => b.impact.criticalBalanceAfter - a.impact.criticalBalanceAfter || a.impact.totalCost - b.impact.totalCost || a.id - b.id)
    .slice(0, 3);
}
