import { addDays } from "@/lib/calendar/hijri";
import { DAYS_PER_MONTH } from "./estimate";
import { withExcuseDays } from "./available";
import { PRAYERS, type PrayerKind } from "./kinds";

// «القضاء»: today's amount and the finish dates. Pure.

export type PrayerQuota = {
  // what's left divided by the days available (unrounded; compared with the goal's start)
  rate: number;
  // today's total, a whole number
  total: number;
  // shared out by what's left of each prayer
  per: Record<PrayerKind, number>;
};

const zero = (): Record<PrayerKind, number> => ({ FAJR: 0, DHUHR: 0, ASR: 0, MAGHRIB: 0, ISHA: 0 });

/**
 * «موعد»: today's prayers. The total is what's left ÷ the days available,
 * rounded up; it's shared between the prayers by what's left of each
 * (largest remainder, ties in the order of the day), never more of one than
 * is left of it.
 */
export function prayerQuota(remaining: Record<PrayerKind, number>, available: number): PrayerQuota {
  const left = PRAYERS.reduce((s, p) => s + remaining[p], 0);
  const per = zero();
  if (left === 0) return { rate: 0, total: 0, per };
  const rate = left / Math.max(available, 1);
  const total = Math.min(left, Math.ceil(rate - 1e-9));
  const share = PRAYERS.map((p) => ({ p, exact: (total * remaining[p]) / left }));
  let given = 0;
  for (const s of share) {
    per[s.p] = Math.min(remaining[s.p], Math.floor(s.exact));
    given += per[s.p];
  }
  const order = [...share].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || PRAYERS.indexOf(a.p) - PRAYERS.indexOf(b.p));
  while (given < total) {
    const next = order.find((s) => per[s.p] < remaining[s.p]);
    if (!next) break;
    per[next.p]++;
    given++;
    order.push(order.splice(order.indexOf(next), 1)[0]);
  }
  return { rate, total, per };
}

/** «وتيرة»: today's prayers at her pace (k of each), never more than is left of it. */
export function prayerPaceToday(remaining: Record<PrayerKind, number>, pace: number): PrayerQuota {
  const per = zero();
  for (const p of PRAYERS) per[p] = Math.min(remaining[p], pace);
  const total = PRAYERS.reduce((s, p) => s + per[p], 0);
  return { rate: total, total, per };
}

/** An average week of hers: 7 days less her excuse days in it. */
const weekDays = (avg: number | null) => (7 * (DAYS_PER_MONTH - Math.min(avg ?? 0, DAYS_PER_MONTH - 1))) / DAYS_PER_MONTH;

/** «موعد» for fasting: days per week (unrounded) over the days available. */
export function fastPerWeek(remaining: number, available: number, avg: number | null): number {
  if (remaining === 0) return 0;
  const weeks = Math.max(available, 1) / weekDays(avg);
  return remaining / weeks;
}

/** «وتيرة» for prayers: the last day, at k of each prayer a day, with her excuse days in between. null: nothing left. */
export function prayerPaceFinish(remaining: Record<PrayerKind, number>, pace: number, today: string, avg: number | null): string | null {
  const most = Math.max(...PRAYERS.map((p) => remaining[p]));
  if (most === 0 || pace <= 0) return null;
  return addDays(today, withExcuseDays(Math.ceil(most / pace), avg) - 1);
}

// beyond this many days a pace never finishes (shown as no date)
const FAR = 365 * 60;

/** «وتيرة» for fasting: the last day, at k days a week, with her excuse days and the days left out in between. */
export function fastPaceFinish(remaining: number, pace: number, today: string, avg: number | null, blocked: (day: string) => boolean): string | null {
  if (remaining === 0 || pace <= 0) return null;
  // days that aren't left out, as many as those weeks have
  let need = Math.ceil((remaining / (pace * (weekDays(avg) / 7))) * 7 - 1e-9);
  let day = today;
  for (let i = 0; i < FAR; i++, day = addDays(day, 1)) {
    if (blocked(day)) continue;
    if (--need <= 0) return day;
  }
  return null;
}

/**
 * Where she stands against the goal's start: ahead when the amount now is
 * clearly below it, «هل تودّين تمديد الموعد؟» past twice it. Behind is never
 * said: only the new amount shows.
 */
export function standing(rate: number, baseline: number | null): "ahead" | "extend" | "even" {
  if (!baseline || baseline <= 0) return "even";
  if (rate > 2 * baseline) return "extend";
  if (rate <= 0.85 * baseline) return "ahead";
  return "even";
}
