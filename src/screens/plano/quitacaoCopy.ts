// Pure: pt-BR wording for Quitação, Estratégias and Roteiro (plano-de-quitacao §3.5, §4). Neutral, never "take credit".
import type { Bridge, DebtReading, DebtView, Strategy } from '../../engine';
import { formatBRL } from '../../lib/money';

export const pct = (rate: number): string => `${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const READING: Record<DebtReading, { label: string; tone: 'ok' | 'warn' }> = {
  custa_mais_que_credito: { label: 'Custa mais que o crédito que você informou', tone: 'warn' },
  alivio: { label: 'Alívio, se sobrar caixa', tone: 'ok' },
  alivio_sem_caixa: { label: 'Alívio, mas falta caixa agora', tone: 'warn' },
  deixar_correr: { label: 'Custa menos que o rendimento do seu caixa', tone: 'ok' },
};

/** The one-line "why" under each debt. */
export function debtWhy(v: DebtView, ctx: { bridgeRate?: number; cashYield: number }): string {
  if (v.payoffAmount === null) return 'O contrato não permite quitar antes.';
  if (v.monthlyReturn === null) return 'Com esse valor de quitação não dá para calcular o retorno. Confira a cotação.';
  const r = `Quitar agora rende ${pct(v.monthlyReturn)} ao mês`;
  switch (v.reading) {
    case 'custa_mais_que_credito':
      return `${r}; o crédito mais barato que você informou custa ${pct(ctx.bridgeRate ?? 0)} ao mês.`;
    case 'deixar_correr':
      return `${r}; o dinheiro parado na conta rende ${pct(ctx.cashYield)} ao mês.`;
    case 'alivio':
      return `${r} e o saldo continua acima da reserva mínima. Evita ${formatBRL(v.avoidedTotal)} em parcelas.`;
    case 'alivio_sem_caixa':
      return `${r}, mas o saldo ficaria abaixo da reserva mínima em algum mês.`;
    default:
      return r + '.';
  }
}

export function bridgeLabel(b: Bridge): string {
  if (b.kind === 'meta') return `Se você conseguir ${pct(b.monthlyRate)} ao mês (meta, não oferta)`;
  if (b.kind === 'parcelar_fatura') return 'Parcelamento da fatura no mês da falta';
  return `Crédito ponte: ${b.name}, ${pct(b.monthlyRate)} ao mês em ${b.months}x`;
}

const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`);

/** "Quitar Carro e Pix · Crédito ponte: Banco · gasto variável 10% menor". */
export function strategyTitle(s: Pick<Strategy, 'payoffs' | 'bridge' | 'reducedVariable'>): string {
  const parts = [s.payoffs.length ? `Quitar ${list(s.payoffs.map((p) => p.debt.name))}` : 'Sem quitações'];
  if (s.bridge) parts.push(bridgeLabel(s.bridge));
  if (s.reducedVariable) parts.push('gasto variável 10% menor');
  return parts.join(' · ');
}

export const CRITERIA = [
  { value: 'custo_medio' as const, label: 'Menor custo mensal' },
  { value: 'custo_fim' as const, label: 'Menor custo no fim' },
  { value: 'menos_credito' as const, label: 'Menos crédito novo' },
];
