import { cents } from './dates';
import { priceSchedule } from './debt';
import { paramRow } from './params';
import type { Parameter } from './types';

export interface WorstCase {
  unpaid: number;
  totalPaid: number;
  /** totalPaid − unpaid. Capped at encargos_cap_ratio × unpaid. */
  totalCharges: number;
  capped: boolean;
  monthlyPayment: number;
  /** Payment k lands on the card invoice k months after the partial one. */
  payments: number[];
  /** Parameters used (premissas), shown to the user (spec 04 item 6). */
  assumptions: Parameter[];
  notes: string[];
}

const NOTES = ['IOF, multa e juros de mora não incluídos.', 'Pior caso estimado: um ciclo no rotativo, depois o parcelamento da fatura.'];

/**
 * "Minha fatura é maior que o que eu recebo" (spec 05). The unpaid part pays one cycle of
 * rotativo, then moves to the parcelamento da fatura. Total charges are capped at
 * `encargos_cap_ratio` × unpaid (Lei 14.690/2023), so with the default the debt at most doubles.
 */
export function worstCase(unpaid: number, months: number, params: Parameter[], today: string): WorstCase {
  const rotativo = paramRow(params, 'rotativo_monthly_rate', today);
  const parcelado = paramRow(params, 'parcelado_fatura_monthly_rate', today);
  const cap = paramRow(params, 'encargos_cap_ratio', today);
  const assumptions = [rotativo, parcelado, cap];
  if (!Number.isFinite(unpaid) || unpaid <= 0) {
    return { unpaid: 0, totalPaid: 0, totalCharges: 0, capped: false, monthlyPayment: 0, payments: [], assumptions, notes: NOTES };
  }

  const afterRotativo = cents(unpaid * (1 + rotativo.value));
  let payments = priceSchedule(afterRotativo, parcelado.value, months).map((r) => r.payment);
  const uncapped = cents(payments.reduce((s, p) => s + p, 0));
  const maxTotal = cents(unpaid * (1 + cap.value));
  const capped = uncapped > maxTotal;

  if (capped) {
    const factor = maxTotal / uncapped;
    payments = payments.map((p) => cents(p * factor));
    const others = payments.slice(0, -1).reduce((s, p) => s + p, 0);
    payments[payments.length - 1] = cents(maxTotal - others);
  }

  const totalPaid = cents(payments.reduce((s, p) => s + p, 0));
  return {
    unpaid: cents(unpaid),
    totalPaid,
    totalCharges: cents(totalPaid - unpaid),
    capped,
    monthlyPayment: payments[0],
    payments,
    assumptions,
    notes: NOTES,
  };
}
