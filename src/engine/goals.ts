import { addMonths, cents, monthDiff, monthOf } from './dates';
import { freeMargin } from './metrics';
import { param } from './params';
import type { Goal, Profile } from './types';

export interface Contribution {
  month: string;
  amount: number;
}

/** What each month can put toward goals: the positive part of the free margin, month by month. */
export function contributions(profile: Profile, today: string): Contribution[] {
  const months = param(profile.parameters, 'projection_months', today);
  return Array.from({ length: months }, (_, k) => {
    const month = addMonths(monthOf(today), k);
    return { month, amount: cents(Math.max(0, freeMargin(profile, month, today))) };
  });
}

export interface GoalProgress {
  goal: Goal;
  /** Month the target is reached, or null when not within the horizon. */
  reachedMonth: string | null;
}

/**
 * Fills goals in priority order (1 first): the top goal takes each month's contribution until
 * it is reached, then the next one. A goal already reached counts from the first month.
 */
export function goalTimeline(goals: Goal[], contribs: Contribution[]): GoalProgress[] {
  const ordered = [...goals].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  const remaining = ordered.map((g) => cents(Math.max(0, g.target - g.saved)));
  const reached: (string | null)[] = ordered.map(() => null);
  let i = 0;
  const settle = (month: string) => {
    while (i < ordered.length && remaining[i] <= 0) reached[i++] = month;
  };
  if (contribs.length > 0) settle(contribs[0].month);
  for (const { month, amount } of contribs) {
    let available = amount;
    while (available > 0 && i < ordered.length) {
      const take = Math.min(available, remaining[i]);
      remaining[i] = cents(remaining[i] - take);
      available = cents(available - take);
      settle(month);
    }
  }
  return ordered.map((goal, k) => ({ goal, reachedMonth: reached[k] }));
}

export interface GoalDelay {
  goalId: string;
  name: string;
  baseline: string | null;
  scenario: string | null;
  /** Months later than before (0 when unchanged); null when a reachable goal stops being reachable. */
  delayMonths: number | null;
}

/** "Essa compra atrasa sua reserva em 3 meses" (spec 03). */
export function goalDelays(baseline: Profile, scenario: Profile, today: string): GoalDelay[] {
  const before = goalTimeline(baseline.goals, contributions(baseline, today));
  const after = goalTimeline(scenario.goals, contributions(scenario, today));
  return before.map(({ goal, reachedMonth }) => {
    const changed = after.find((a) => a.goal.id === goal.id)?.reachedMonth ?? null;
    let delayMonths: number | null = 0;
    if (reachedMonth && changed) delayMonths = monthDiff(reachedMonth, changed);
    else if (reachedMonth && !changed) delayMonths = null;
    return { goalId: goal.id, name: goal.name, baseline: reachedMonth, scenario: changed, delayMonths };
  });
}

/** On track: reached by the deadline month, or (without a deadline) within the horizon. */
export const onTrack = (p: GoalProgress): boolean =>
  p.reachedMonth !== null && (!p.goal.deadline || p.reachedMonth <= monthOf(p.goal.deadline));
