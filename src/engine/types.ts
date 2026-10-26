// Financial model from 02-modelo-de-dados. Money is in BRL, stored as numbers
// rounded to cents by the engine. Dates are ISO "YYYY-MM-DD"; months are "YYYY-MM".

export interface Card {
  id: string;
  bank: string;
  name: string;
  closingDay: number;
  dueDay: number;
  limit: number;
  /** Variable spend per cycle, the user's average estimate (parâmetro). */
  variableEstimate: number;
}

/** A future installment already committed on a card, summed per invoice month. */
export interface Installment {
  cardId: string;
  dueMonth: string;
  amount: number;
}

/** A recurring income or outflow, placed on a day of the month. */
export interface RecurringItem {
  name: string;
  amount: number;
  day: number;
}

export interface Profile {
  netIncome: number;
  incomes: RecurringItem[];
  outflows: RecurringItem[];
  cards: Card[];
  installments: Installment[];
  /** Balance informed by the user on `balanceDate`. */
  balance: number;
  balanceDate: string;
}

/** One dated cash movement; positive = money in, negative = money out. */
export interface CashEvent {
  date: string;
  amount: number;
  label: string;
}
