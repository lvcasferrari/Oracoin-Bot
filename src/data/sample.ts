import { DEFAULT_PARAMETERS } from '../engine';
import type { Profile } from '../engine';

// Example profile for tests and the dev-only "Dados de exemplo" button.
export const sampleProfile: Profile = {
  accounts: [{ id: 'conta-nu', bank: 'Nubank', kind: 'corrente', balance: 3000 }],
  balanceDate: '2026-11-01',
  entries: [
    { id: 'salario', kind: 'in', name: 'Salário', amount: 6000, day: 5, recurrence: 'monthly', startMonth: '2026-01' },
    { id: 'aluguel', kind: 'out', name: 'Aluguel', amount: 2000, day: 10, recurrence: 'monthly', startMonth: '2026-01', category: 'moradia' },
    { id: 'mercado', kind: 'out', name: 'Mercado', amount: 900, day: 20, recurrence: 'monthly', startMonth: '2026-01', category: 'alimentacao' },
  ],
  cards: [
    { id: 'nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 8000, variableEstimate: 800 },
    { id: 'itau', bank: 'Itaú', name: 'Platinum', closingDay: 8, dueDay: 15, limit: 5000, variableEstimate: 500 },
  ],
  installments: [
    { id: 'p-nu-11', cardId: 'nu', dueMonth: '2026-11', amount: 1200 },
    { id: 'p-nu-12', cardId: 'nu', dueMonth: '2026-12', amount: 1200 },
    { id: 'p-itau-11', cardId: 'itau', dueMonth: '2026-11', amount: 600 },
  ],
  invoices: [],
  debts: [],
  goals: [],
  parameters: DEFAULT_PARAMETERS,
};
