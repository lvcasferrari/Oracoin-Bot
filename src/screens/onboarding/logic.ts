// Pure onboarding decisions (tested in Vitest).
import {
  addMonths,
  cents,
  closingDate,
  commitmentRatio,
  dailyView,
  dueDate,
  freeMargin,
  monthOf,
  param,
  payday,
  type Card,
  type Invoice,
  type Parameter,
  type Profile,
} from '../../engine';
import { formatDateBR, shortMonth } from '../../lib/dateInput';
import { formatBRL } from '../../lib/money';

/** First invoice month whose due date is today or later. */
export function nextDueMonth(card: Card, today: string): string {
  const month = monthOf(today);
  return dueDate(card, month) >= today ? month : addMonths(month, 1);
}

/**
 * "Quanto vem na próxima fatura?" becomes a stored invoice: confirmed when that cycle has already
 * closed, otherwise the user's estimate (it keeps the "estimado" label until confirmed).
 */
export function onboardingInvoice(card: Card, amount: number, today: string, params: Parameter[], id: string): Invoice {
  const dueMonth = nextDueMonth(card, today);
  const closingDayCountsAsClosed = param(params, 'purchase_on_closing_day_next_invoice', today) >= 0.5;
  const closing = closingDate(card, dueMonth);
  const closed = closingDayCountsAsClosed ? closing <= today : closing < today;
  return { id, cardId: card.id, dueMonth, amount, origin: closed ? 'confirmada' : 'estimada', status: 'fechada' };
}

/** Variable spend per cycle when the user did not type one: next invoice minus its known installments. */
export const defaultVariableEstimate = (nextInvoice: number, installmentsThatMonth: number): number =>
  cents(Math.max(0, nextInvoice - installmentsThatMonth));

/** Launch route: onboarding only for a first run with nothing entered yet. */
export const initialRoute = (onboardedAt: string | undefined, empty: boolean): 'Onboarding' | 'Tabs' =>
  !onboardedAt && empty ? 'Onboarding' : 'Tabs';

/** The single insight sentence of the Raio-X, built only from engine output. */
export function raioXInsight(profile: Profile, today: string): string {
  const month = addMonths(monthOf(today), 1);
  const label = shortMonth(month);
  const days = dailyView(profile, month, today);
  const low = days.reduce<(typeof days)[number] | null>((min, d) => (!min || d.balance < min.balance ? d : min), null);
  const pay = payday(profile);

  if (low && low.balance < 0) {
    const early = days.find((d) => d.source === 'invoice' && pay !== null && Number(d.date.slice(8)) < pay);
    if (early) {
      return `Em ${label}, a ${early.label} vence dia ${Number(early.date.slice(8))}, antes do salário (dia ${pay}), e o saldo fica negativo. Em "E se…?" dá para ver o efeito de mudar o vencimento.`;
    }
    return `Em ${label}, o saldo previsto fica negativo em ${formatDateBR(low.date)}. Em "E se…?" dá para comparar as saídas antes de decidir.`;
  }

  const ratio = commitmentRatio(profile, month, today);
  if (Number.isFinite(ratio) && ratio >= param(profile.parameters, 'commitment_band_orange', today)) {
    return `Em ${label}, faturas e dívidas levam ${Math.round(ratio * 100)}% da sua renda. Antes de uma compra nova, vale simular o efeito nas próximas faturas.`;
  }
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} fecha com ${formatBRL(freeMargin(profile, month, today))} de folga. Bom ponto de partida.`;
}
