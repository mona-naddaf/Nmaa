// «المحصّلات»: periodic summaries of «جدول المتابعة». Pure and client-safe;
// the server loads the rows (summary-data.ts), the page draws them.
//
// Commitment (agreed rules):
//  - An item is due on a day when: the day is one of its weekdays, the item
//    existed and was approved that day (from its first due day, until the day
//    it was archived), and the day is in the past. Today counts only once
//    ticked, so an unfinished today is never a miss.
//  - Per item: days ticked ÷ days due. Overall: weighted by value
//    (Σ value × ticked ÷ Σ value × due), as the day scores are.
//  - A day with nothing due is neutral (a different tile from 0%).
//  - Days are "YYYY-MM-DD": the course's days (its time zone), or «رفيق
//    الحفظ»'s own. Weeks run Sunday–Saturday.

import { addDays, isActiveOn, weekStart } from "./rules";
import { GREGORIAN_MONTHS } from "@/lib/calendar/hijri";

export type PeriodKind = "week" | "month" | "quarter" | "half" | "year";
export const PERIOD_KINDS: PeriodKind[] = ["week", "month", "quarter", "half", "year"];
export const PERIOD_LABEL: Record<PeriodKind, string> = { week: "أسبوع", month: "شهر", quarter: "ربع سنة", half: "نصف سنة", year: "سنة" };
const PREVIOUS: Record<PeriodKind, string> = {
  week: "الأسبوع السابق",
  month: "الشهر السابق",
  quarter: "الربع السابق",
  half: "النصف السابق",
  year: "السنة السابقة",
};
// how far back the arrows go
export const OFFSET_MIN = -120;

export const isPeriodKind = (v: unknown): v is PeriodKind => typeof v === "string" && (PERIOD_KINDS as string[]).includes(v);
export const clampOffset = (v: unknown) => (Number.isInteger(v) ? Math.max(OFFSET_MIN, Math.min(0, v as number)) : 0);

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const ymd = (day: string) => day.split("-").map(Number) as [number, number, number];

/** The first day of the month `months` after (or before) the given month. */
function monthStart(y: number, m: number, months: number): string {
  const index = y * 12 + (m - 1) + months;
  return iso(Math.floor(index / 12), (index % 12) + 1, 1);
}

/** A period's days, inclusive ("YYYY-MM-DD"): the one containing `today`, moved by `offset` periods. */
export function periodRange(kind: PeriodKind, today: string, offset = 0): { from: string; to: string } {
  const [y, m] = ymd(today);
  if (kind === "week") {
    const from = addDays(weekStart(today), offset * 7);
    return { from, to: addDays(from, 6) };
  }
  const months = kind === "month" ? 1 : kind === "quarter" ? 3 : kind === "half" ? 6 : 12;
  const first = Math.floor((m - 1) / months) * months + 1; // the period's first month
  const from = monthStart(y, first, offset * months);
  const [fy, fm] = ymd(from);
  return { from, to: addDays(monthStart(fy, fm, months), -1) };
}

/** «11 – 17 أكتوبر 2026», «أكتوبر 2026», «الربع الرابع 2026», «النصف الثاني 2026», «2026». */
export function periodLabel(kind: PeriodKind, from: string, to: string): string {
  const [fy, fm, fd] = ymd(from);
  const [ty, tm, td] = ymd(to);
  if (kind === "week") {
    if (fy !== ty) return `${fd} ${GREGORIAN_MONTHS[fm - 1]} ${fy} – ${td} ${GREGORIAN_MONTHS[tm - 1]} ${ty}`;
    if (fm !== tm) return `${fd} ${GREGORIAN_MONTHS[fm - 1]} – ${td} ${GREGORIAN_MONTHS[tm - 1]} ${ty}`;
    return `${fd} – ${td} ${GREGORIAN_MONTHS[fm - 1]} ${fy}`;
  }
  if (kind === "month") return `${GREGORIAN_MONTHS[fm - 1]} ${fy}`;
  if (kind === "quarter") return `الربع ${["الأول", "الثاني", "الثالث", "الرابع"][Math.floor((fm - 1) / 3)]} ${fy}`;
  if (kind === "half") return `النصف ${fm <= 6 ? "الأول" : "الثاني"} ${fy}`;
  return String(fy);
}

/** An item as the summary sees it. fromDay: its first due day; untilDay: its archive day (exclusive), if any. */
export interface SummaryItem {
  id: string;
  title: string;
  value: number;
  days: number; // weekday bitmask
  fromDay: string;
  untilDay: string | null;
}

export interface DayCell {
  day: string;
  // future: after today; neutral: nothing scheduled; scored: something was scheduled
  state: "future" | "neutral" | "scored";
  // what was scheduled that day and what was ticked, weighted by value (today: all of today's items)
  possible: number;
  earned: number;
  today: boolean;
}

export interface ItemCommitment {
  id: string;
  title: string;
  value: number;
  due: number;
  done: number;
  // 0–100, or null when it was never due in the period
  percent: number | null;
}

export interface Summary {
  from: string;
  to: string;
  days: DayCell[];
  items: ItemCommitment[];
  // weighted 0–100, or null when nothing was due
  overall: number | null;
  // days (up to today) with something scheduled, and those fully done
  scoredDays: number;
  completeDays: number;
  // longest run of fully completed days (neutral days neither count nor break; an unfinished today doesn't break)
  bestRun: number;
}

/** Scheduled that day: one of its weekdays, within its life (existing and approved). */
export const scheduledOn = (item: SummaryItem, day: string) =>
  day >= item.fromDay && (item.untilDay === null || day < item.untilDay) && isActiveOn(item.days, day);

export function computeSummary({
  items,
  checks,
  from,
  to,
  today,
}: {
  items: SummaryItem[];
  // day → ids ticked that day
  checks: Record<string, string[]>;
  from: string;
  to: string;
  today: string;
}): Summary {
  // seen: scheduled on some day of the period up to today
  const per = new Map(items.map((i) => [i.id, { due: 0, done: 0, seen: false }]));
  const days: DayCell[] = [];
  let dueWeight = 0;
  let doneWeight = 0;
  let scoredDays = 0;
  let completeDays = 0;
  let run = 0;
  let bestRun = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (day > today) {
      days.push({ day, state: "future", possible: 0, earned: 0, today: false });
      continue;
    }
    const ticked = new Set(checks[day] ?? []);
    let possible = 0;
    let earned = 0;
    for (const item of items) {
      if (!scheduledOn(item, day)) continue;
      per.get(item.id)!.seen = true;
      possible += item.value;
      const on = ticked.has(item.id);
      if (on) earned += item.value;
      // today counts only once ticked
      if (day < today || on) {
        const p = per.get(item.id)!;
        p.due++;
        dueWeight += item.value;
        if (on) {
          p.done++;
          doneWeight += item.value;
        }
      }
    }
    const isToday = day === today;
    days.push({ day, state: possible > 0 ? "scored" : "neutral", possible, earned, today: isToday });
    if (possible === 0) continue;
    scoredDays++;
    if (earned >= possible) {
      completeDays++;
      run++;
      bestRun = Math.max(bestRun, run);
    } else if (!isToday) {
      run = 0;
    }
  }
  return {
    from,
    to,
    days,
    // items never scheduled in the period (so far) aren't part of it
    items: items
      .filter((i) => per.get(i.id)!.seen)
      .map((i) => {
        const p = per.get(i.id)!;
        return { id: i.id, title: i.title, value: i.value, due: p.due, done: p.done, percent: p.due ? (p.done / p.due) * 100 : null };
      }),
    overall: dueWeight ? (doneWeight / dueWeight) * 100 : null,
    scoredDays,
    completeDays,
    bestRun,
  };
}

/** «+12٪ عن الشهر السابق», «−5٪ …», «مثل الشهر السابق»; null when either has nothing due. */
export function comparisonLabel(kind: PeriodKind, current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) return null;
  const diff = Math.round(current) - Math.round(previous);
  if (diff === 0) return `مثل ${PREVIOUS[kind]}`;
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)}٪ عن ${PREVIOUS[kind]}`;
}

/** A percentage as shown: «87٪». */
export const percentLabel = (p: number | null) => (p === null ? "—" : `${Math.round(p)}٪`);
