import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMETERS } from '../../engine';
import { makeProfile, nubank } from '../../engine/testing';
import { defaultVariableEstimate, initialRoute, nextDueMonth, onboardingInvoice, raioXInsight } from './logic';

describe('onboarding logic', () => {
  // Nubank closes on the 5th and is due on the 12th.
  it('picks the next invoice whose due date is still ahead', () => {
    expect(nextDueMonth(nubank, '2026-11-12')).toBe('2026-11');
    expect(nextDueMonth(nubank, '2026-11-13')).toBe('2026-12');
  });
  it('stores the typed amount as confirmed only when that cycle already closed', () => {
    expect(onboardingInvoice(nubank, 1900, '2026-11-08', DEFAULT_PARAMETERS, 'i')).toMatchObject({ dueMonth: '2026-11', origin: 'confirmada', amount: 1900 });
    expect(onboardingInvoice(nubank, 1900, '2026-11-02', DEFAULT_PARAMETERS, 'i')).toMatchObject({ dueMonth: '2026-11', origin: 'estimada' });
  });
  it('derives the variable estimate from the next invoice minus its installments, never below zero', () => {
    expect(defaultVariableEstimate(2000, 1200)).toBe(800);
    expect(defaultVariableEstimate(500, 1200)).toBe(0);
  });
  it('opens onboarding only on a first run with nothing entered', () => {
    expect(initialRoute(undefined, true)).toBe('Onboarding');
    expect(initialRoute(undefined, false)).toBe('Tabs');
    expect(initialRoute('2026-11-01', true)).toBe('Tabs');
  });
});

describe('Raio-X insight', () => {
  it('points out an invoice due before payday that turns the balance negative', () => {
    const profile = makeProfile({
      accounts: [{ id: 'c', bank: 'Nubank', kind: 'corrente', balance: 0 }],
      entries: [{ id: 'sal', kind: 'in', name: 'Salário', amount: 3000, day: 20, recurrence: 'monthly', startMonth: '2026-01' }],
      installments: [{ id: 'p', cardId: 'nu', dueMonth: '2026-12', amount: 2500 }],
    });
    // Dec 12: invoice 2500 + 800 before the salary on the 20th.
    expect(raioXInsight(profile, '2026-11-25')).toMatch(/vence dia 12, antes do salário \(dia 20\)/);
  });
  it('reports the slack of a comfortable month', () => {
    expect(raioXInsight(makeProfile(), '2026-11-01')).toMatch(/^Dez\/26 fecha com R\$\s?3\.200,00 de folga/);
  });
});
