import { addMonths, DEFAULT_PARAMETERS, monthOf } from '../engine';
import type { Profile } from '../engine';

/** Example profile anchored on `today` (tests and the dev-only "Dados de exemplo" button). */
export function makeSample(today: string): Profile {
  const month = monthOf(today);
  return {
    accounts: [{ id: 'conta-nu', bank: 'Nubank', kind: 'corrente', balance: 3000 }],
    balanceDate: today,
    entries: [
      { id: 'salario', kind: 'in', name: 'Salário', amount: 6000, day: 5, recurrence: 'monthly', startMonth: addMonths(month, -1) },
      { id: 'aluguel', kind: 'out', name: 'Aluguel', amount: 2000, day: 10, recurrence: 'monthly', startMonth: addMonths(month, -1), category: 'moradia' },
      { id: 'mercado', kind: 'out', name: 'Mercado', amount: 900, day: 20, recurrence: 'monthly', startMonth: addMonths(month, -1), category: 'alimentacao' },
    ],
    cards: [
      { id: 'nu', bank: 'Nubank', name: 'Roxinho', closingDay: 5, dueDay: 12, limit: 8000, variableEstimate: 800 },
      { id: 'itau', bank: 'Itaú', name: 'Platinum', closingDay: 8, dueDay: 15, limit: 5000, variableEstimate: 500 },
    ],
    installments: [
      { id: 'p-nu-0', cardId: 'nu', dueMonth: month, amount: 1200 },
      { id: 'p-nu-1', cardId: 'nu', dueMonth: addMonths(month, 1), amount: 1200 },
      { id: 'p-itau-0', cardId: 'itau', dueMonth: month, amount: 600 },
    ],
    invoices: [],
    debts: [],
    goals: [],
    parameters: DEFAULT_PARAMETERS,
  };
}

export const sampleProfile: Profile = makeSample('2026-11-01');
