// Test fixtures only; not exported from index.ts.
import { DEFAULT_PARAMETERS } from './params';
import type { Card, Profile } from './types';

export const TODAY = '2026-11-01';

export const nubank: Card = { id: 'nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 10000, variableEstimate: 800 };

/** Balance 3000 on Nov 1; salary 6000 on day 5; rent 2000 on day 10; Nubank invoice of Nov = 1200 + 800. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    accounts: [{ id: 'conta', bank: 'Nubank', kind: 'corrente', balance: 3000 }],
    balanceDate: TODAY,
    entries: [
      { id: 'sal', kind: 'in', name: 'Salário', amount: 6000, day: 5, recurrence: 'monthly', startMonth: '2026-01' },
      { id: 'alu', kind: 'out', name: 'Aluguel', amount: 2000, day: 10, recurrence: 'monthly', startMonth: '2026-01', category: 'moradia' },
    ],
    cards: [nubank],
    installments: [{ id: 'p1', cardId: 'nu', dueMonth: '2026-11', amount: 1200 }],
    invoices: [],
    debts: [],
    goals: [],
    parameters: DEFAULT_PARAMETERS,
    ...overrides,
  };
}
