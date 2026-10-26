import type { Profile } from '../engine/types';

// Placeholder profile until onboarding (07-ux) stores real user data.
export const sampleProfile: Profile = {
  netIncome: 6000,
  incomes: [{ name: 'Salário', amount: 6000, day: 5 }],
  outflows: [
    { name: 'Aluguel', amount: 2000, day: 10 },
    { name: 'Mercado', amount: 900, day: 20 },
  ],
  cards: [
    { id: 'nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 8000, variableEstimate: 800 },
    { id: 'itau', bank: 'Itaú', name: 'Platinum', closingDay: 8, dueDay: 15, limit: 5000, variableEstimate: 500 },
  ],
  installments: [
    { cardId: 'nu', dueMonth: '2026-11', amount: 1200 },
    { cardId: 'nu', dueMonth: '2026-12', amount: 1200 },
    { cardId: 'itau', dueMonth: '2026-11', amount: 600 },
  ],
  balance: 3000,
  balanceDate: '2026-11-01',
};
