// Financial model from spec 02. Money is in BRL (reais), rounded to cents by the engine.
// Dates are ISO "YYYY-MM-DD"; months are "YYYY-MM". `endMonth` is inclusive.

export const PARAM_KEYS = [
  'rotativo_monthly_rate',
  'parcelado_fatura_monthly_rate',
  'encargos_cap_ratio',
  'partial_plan_default_months',
  'projection_months',
  'commitment_band_yellow',
  'commitment_band_orange',
  'commitment_band_red',
  'verdict_tight_income_share',
  'verdict_attention_income_share',
  'verdict_limit_tight',
  'verdict_limit_attention',
  'reserve_target_months',
  'score_weight_controle',
  'score_weight_colchao',
  'score_weight_metas',
  'score_weight_liberdade',
  'controle_full_margin_share',
  'rotativo_lookback_months',
  'variable_estimate_uncertainty',
  'purchase_on_closing_day_next_invoice',
] as const;

export type ParamKey = (typeof PARAM_KEYS)[number];

/** A dated assumption (premissa). Never hard-code these values in logic (spec 06 rule 6). */
export interface Parameter {
  key: ParamKey;
  value: number;
  effectiveFrom: string;
  source: string;
  note?: string;
}

export type Category = 'moradia' | 'alimentacao' | 'transporte' | 'lazer' | 'dividas' | 'outros';

export interface Account {
  id: string;
  bank: string;
  kind: 'corrente' | 'poupanca' | 'carteira';
  balance: number;
}

export interface Card {
  id: string;
  bank: string;
  name: string;
  closingDay: number;
  dueDay: number;
  limit: number;
  /** Variable spend per cycle, the user's average estimate. */
  variableEstimate: number;
  /** Available limit as informed by the user (preferred over any estimate, spec 05). */
  availableInformed?: number;
}

/** A consolidated income or outflow (lançamento consolidado). */
export interface Entry {
  id: string;
  kind: 'in' | 'out';
  name: string;
  amount: number;
  day: number;
  recurrence: 'once' | 'monthly' | 'yearly';
  startMonth: string;
  endMonth?: string;
  /** Only for `once`. */
  date?: string;
  accountId?: string;
  /** Only for kind 'out': charged on this card and paid through its invoice. */
  cardId?: string;
  category?: Category;
}

/** Future installments on a card, summed per invoice month (not purchase by purchase). */
export interface Installment {
  id: string;
  cardId: string;
  dueMonth: string;
  amount: number;
}

/** A stored invoice. Without a row, the invoice of a month is projected. */
export interface Invoice {
  id: string;
  cardId: string;
  dueMonth: string;
  amount: number;
  /** 'estimada' = a value the user typed before the invoice closed (e.g. onboarding). */
  origin: 'estimada' | 'confirmada';
  status: 'fechada' | 'paga' | 'parcial';
  paidAmount?: number;
  partialPlanMonths?: number;
  /** The projection shown when the user confirmed the real amount (forecast-quality metric). */
  estimatedAtConfirm?: number;
}

export interface Debt {
  id: string;
  name: string;
  kind: 'financiamento' | 'emprestimo' | 'hipoteca' | 'pix_credito';
  /** Outstanding balance now. */
  principal: number;
  /** Contract rate per month, as a fraction (0.02 = 2% a.m.). */
  monthlyRate: number;
  /** Payments left. */
  months: number;
  system: 'price' | 'sac';
  /** Month of the next payment. */
  startMonth: string;
  dueDay: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string;
  /** 1 = highest priority. */
  priority: number;
}

export type ScenarioChange =
  | { type: 'purchase'; cardId: string; total: number; installments: number; date?: string; interestMonthly?: number }
  | { type: 'debt'; debt: Omit<Debt, 'id'>; downPayment: number; incomeStressPct?: number }
  | { type: 'subscription'; name?: string; amount: number; day: number; cardId?: string }
  | { type: 'incomeChange'; deltaPct?: number; deltaAmount?: number; months: number; startMonth: string }
  | { type: 'costChange'; name?: string; amount: number; category?: Category; startMonth: string }
  | { type: 'emergency'; amount: number; date: string }
  | { type: 'payPartial'; cardId: string; dueMonth: string; payNow: number; months: number };

export interface Scenario {
  id: string;
  name: string;
  changes: ScenarioChange[];
}

export interface Profile {
  accounts: Account[];
  // shortcut: one balance date for all accounts; per-account dates when accounts are updated separately (V1)
  balanceDate: string;
  entries: Entry[];
  cards: Card[];
  installments: Installment[];
  invoices: Invoice[];
  debts: Debt[];
  goals: Goal[];
  parameters: Parameter[];
}

/** One dated cash movement; positive = money in, negative = money out. */
export interface CashEvent {
  date: string;
  amount: number;
  label: string;
  source: 'entry' | 'invoice' | 'debt';
  refId: string;
  /** True when the amount was not confirmed by the user (shown as "estimado"). */
  estimated: boolean;
}
