import { addDays, daysBetween } from "@/lib/calendar/hijri";
import { DAYS_PER_MONTH } from "./estimate";

// «القضاء»: how many days are really left for qada until a deadline — the
// calendar days, less the days left out (fasting only: fasting-days.ts),
// less the excuse days still expected. Pure.
//
// Excuse-aware from the start (Mona, 2026-11-15): the expected excuse days
// are taken out before anything is divided, so a month gives her ~23 days,
// not 30, and an excuse of her usual length changes nothing afterwards —
// no catching up after it.
//
// How: the whole plan (from the day the goal was set to the deadline) has
// an excuse budget, her average per 30 days. Every excuse she recorded in
// «أيام العذر» since then uses it up, each by at most her average + 3 days:
// a much longer excuse uses only that much, and the extra days count as
// days without qada, so the amount then rises a little, spread over what's
// left. What's still expected stays within one cycle of her average spread
// evenly. Without «أيام العذر» records (excuses: null) it is simply her
// average spread evenly over the days left. A man: no excuse days at all.

/** One excuse, by her days, both ends included; end null: still open. */
export type ExcuseSpan = { start: string; end: string | null };

/** How far beyond her average one excuse may use the budget. */
export const EXCUSE_SLACK_DAYS = 3;

export type AvailableInput = {
  today: string;
  // the last day of the plan (included)
  deadline: string;
  // the day the goal was set
  from: string;
  // her average per month; null or 0: none (a man)
  avg: number | null;
  // her recorded excuses; null: she doesn't record them («أيام العذر» off or not hers)
  excuses: ExcuseSpan[] | null;
  // fasting: the days left out (Ramadan, the Eids…)
  blocked?: Set<string>;
};

export type Available = {
  // days from today to the deadline, without the days left out
  calendar: number;
  // excuse days still expected among them
  excuse: number;
  // what's left for qada (never below 0)
  days: number;
};

function countDays(from: string, to: string, blocked?: Set<string>): number {
  const n = daysBetween(from, to) + 1;
  if (n <= 0) return 0;
  if (!blocked || blocked.size === 0) return n;
  let c = 0;
  for (let i = 0; i < n; i++) if (!blocked.has(addDays(from, i))) c++;
  return c;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function availableDays(i: AvailableInput): Available {
  const calendar = countDays(i.today, i.deadline, i.blocked);
  const avg = clamp(i.avg ?? 0, 0, DAYS_PER_MONTH);
  if (calendar === 0 || avg === 0) return { calendar, excuse: 0, days: calendar };
  const rate = avg / DAYS_PER_MONTH;
  const spread = rate * calendar;
  let excuse = spread;
  if (i.excuses) {
    const start = daysBetween(i.from, i.today) > 0 ? i.from : i.today;
    const budget = rate * countDays(start, i.deadline, i.blocked);
    const yesterday = addDays(i.today, -1);
    let used = 0;
    for (const e of i.excuses) {
      const a = daysBetween(e.start, start) > 0 ? start : e.start;
      const end = e.end === null || daysBetween(yesterday, e.end) > 0 ? yesterday : e.end;
      if (daysBetween(a, end) < 0) continue;
      used += Math.min(countDays(a, end, i.blocked), avg + EXCUSE_SLACK_DAYS);
    }
    excuse = clamp(budget - used, Math.max(0, spread - avg), spread + avg);
  }
  excuse = Math.min(excuse, calendar);
  return { calendar, excuse, days: Math.max(0, calendar - excuse) };
}

/** Days of qada → calendar days, with her excuse days in between (pace mode). */
export const withExcuseDays = (days: number, avg: number | null) => {
  const a = clamp(avg ?? 0, 0, DAYS_PER_MONTH - 1);
  return Math.ceil((days * DAYS_PER_MONTH) / (DAYS_PER_MONTH - a));
};
