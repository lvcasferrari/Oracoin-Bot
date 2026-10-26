// Pure (no react-native) so Vitest can import it.
import { cents } from '../engine';

const MAX = 1e9;

/**
 * Parses money typed in pt-BR: "1.234,56", "0,5", "1234", "R$ 99,90". Returns null for empty,
 * non-numeric, negative or absurd input. A dot followed by groups of three digits is a thousands
 * separator; otherwise a lone dot is read as the decimal point.
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/R\$|\s/g, '');
  if (s === '' || !/^[0-9.,]+$/.test(s)) return null;
  if (s.includes(',')) {
    if (s.indexOf(',') !== s.lastIndexOf(',')) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0 || value > MAX) return null;
  return cents(value);
}

export const formatBRL = (value: number): string => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Value for a money input field: "1234,5" style, empty for undefined. */
export const toInput = (value: number | undefined): string => (value === undefined ? '' : String(value).replace('.', ','));
