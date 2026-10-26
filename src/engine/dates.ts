const pad = (n: number): string => String(n).padStart(2, '0');

// Round to cents so sums never drift.
export const cents = (value: number): number => Math.round(value * 100) / 100;

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const monthOf = (date: string): string => date.slice(0, 7);

const monthIndex = (month: string): number => {
  const [year, m] = month.split('-').map(Number);
  return year * 12 + (m - 1);
};

export function addMonths(month: string, delta: number): string {
  const total = monthIndex(month) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Whole months from `from` to `to` (positive when `to` is later). */
export const monthDiff = (from: string, to: string): number => monthIndex(to) - monthIndex(from);

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Date for a given month and day, clamped to the month's last day (e.g. 31 in February). */
export function dateInMonth(month: string, day: number): string {
  return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** The device's local calendar date. Never use toISOString() for this: it is UTC. */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
