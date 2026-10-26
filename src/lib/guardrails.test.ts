// Plan invariants 2, 4, 7 and 9, checked over the source tree.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER } from './copy';

const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}
const source = files(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

/** Blame and credit/investment words the app must never say (spec 01 principle 5, spec 06 rules 1–2). */
export const BANNED = ['gastou demais', 'irrespons', 'culpa', 'contrate', 'pré-aprovado', 'pre-aprovado', 'invista', 'aplique', 'cdb', 'empréstimo na hora'];

describe('guardrails', () => {
  it('uses the exact disclaimer text from spec 06', () => {
    expect(DISCLAIMER).toBe('Simulação ilustrativa baseada nos dados que você informou. Não é recomendação de investimento nem de crédito.');
  });
  it('never uses blame, credit-offer or investment wording', () => {
    for (const { path, text } of source) {
      const lower = text.toLowerCase();
      for (const word of BANNED) expect(lower.includes(word), `${path} contains "${word}"`).toBe(false);
    }
  });
  it('keeps the engine free of UI and database imports', () => {
    for (const { path, text } of source.filter((f) => f.path.startsWith('engine/'))) {
      expect(/from '(react|react-native|expo[^']*|\.\.\/db[^']*)'/.test(text), path).toBe(false);
    }
  });
  it('has no hard-coded dates in screens, components or navigation', () => {
    const ui = source.filter((f) => /^(screens|components|navigation)\//.test(f.path));
    for (const { path, text } of ui) {
      expect(/\b(TODAY|FIRST_MONTH|sampleProfile)\b|'20\d{2}-\d{2}/.test(text), path).toBe(false);
    }
  });
  it('shows the disclaimer wherever projections or simulations appear', () => {
    const withResults = [
      'screens/HojeScreen.tsx',
      'screens/FluxoScreen.tsx',
      'screens/PlanoScreen.tsx',
      'screens/simulator/ResultCard.tsx',
      'screens/onboarding/RaioX.tsx',
      'screens/upkeep/PayInvoiceScreen.tsx',
    ];
    for (const path of withResults) {
      const file = source.find((f) => f.path === path);
      expect(file?.text.includes('<Disclaimer'), path).toBe(true);
    }
    // The simulator shows results only through the result card.
    expect(source.find((f) => f.path === 'screens/SimuladorScreen.tsx')?.text.includes('<ScenarioResultCard')).toBe(true);
  });
});
