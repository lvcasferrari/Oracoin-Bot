// Pure parsing of dates typed in pt-BR forms.
import { daysInMonth } from '../engine';

/** "11/2026" → "2026-11"; null when invalid. */
export function parseMonthBR(input: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{4})\s*$/.exec(input);
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  return `${m[2]}-${String(month).padStart(2, '0')}`;
}

/** "05/11/2026" → "2026-11-05"; null when invalid (including 31/02). */
export function parseDateBR(input: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(input);
  if (!m) return null;
  const month = parseMonthBR(`${m[2]}/${m[3]}`);
  const day = Number(m[1]);
  if (!month || day < 1 || day > daysInMonth(month)) return null;
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Day of month 1–31, or null. */
export function parseDay(input: string): number | null {
  if (!/^\s*\d{1,2}\s*$/.test(input)) return null;
  const day = Number(input);
  return day >= 1 && day <= 31 ? day : null;
}

export const formatMonthBR = (month: string): string => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
export const formatDateBR = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2026-11" → "nov/26". */
export const shortMonth = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;
