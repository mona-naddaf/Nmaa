// Rules for the daily tracker («جدول المتابعة»), shared by the server
// actions (which enforce them) and the UI (which only mirrors them). Pure:
// no DB, no server-only imports. Days are "YYYY-MM-DD" strings (her local
// date); weekdays are 0 = Sunday … 6 = Saturday; a week runs Sunday–Saturday.

import { acceptLocalDay } from "@/lib/home-log/rules";

// D7 — all checked on the server.
export const TRACKER_LIMITS = {
  ownItemsPerStudent: 10,
  activeItemsPerGroup: 30,
  individualItemsPerStudent: 20,
  titleMax: 60,
  valueMin: 1,
  valueMax: 10,
  // D8: a rejected own item shows «لم يُعتمد» this long, then disappears
  rejectedShowDays: 7,
} as const;

export const EVERY_DAY = 127;
export const WEEKDAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const WEEKDAY_SHORT = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

const MS_DAY = 24 * 60 * 60 * 1000;
const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => fromUtc(toUtc(day) + n * MS_DAY);
export const weekdayOf = (day: string) => new Date(toUtc(day)).getUTCDay();
/** The Sunday that starts this day's week. */
export const weekStart = (day: string) => addDays(day, -weekdayOf(day));
/** Sunday … Saturday of this day's week. */
export const weekDays = (day: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i));
/** The 7 days ending today, oldest first. */
export const lastSevenDays = (today: string) => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

export const isActiveOn = (days: number, day: string) => (days & (1 << weekdayOf(day))) !== 0;

export function validateDays(days: unknown): number | null {
  return Number.isInteger(days) && (days as number) >= 1 && (days as number) <= EVERY_DAY ? (days as number) : null;
}

export function validateValue(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= TRACKER_LIMITS.valueMin && (value as number) <= TRACKER_LIMITS.valueMax
    ? (value as number)
    : null;
}

/** Cleaned title, or an error message. */
export function validateTitle(raw: unknown): { title: string } | { error: string } {
  const title = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (!title) return { error: "يُرجى كتابة اسم البند" };
  if (title.length > TRACKER_LIMITS.titleMax) return { error: `يُرجى ألّا يزيد اسم البند على ${TRACKER_LIMITS.titleMax} حرفًا` };
  return { title };
}

/**
 * The day she may tick: her local today (checked like every home-log day)
 * or the day before it. Returns that day, or null.
 */
export function acceptTickDay(day: string, today: string, now: Date = new Date()): string | null {
  const t = acceptLocalDay(today, now);
  if (!t || typeof day !== "string") return null;
  return day === t || day === addDays(t, -1) ? day : null;
}

export interface ScoredItem {
  id: string;
  value: number | null;
  status: "APPROVED" | "PENDING" | "REJECTED";
  days: number;
  createdDay: string; // YYYY-MM-DD
  archivedDay: string | null; // YYYY-MM-DD
}

/** It existed that day: created on or before it, and not archived on or before it (D6). */
export const existsOn = (item: ScoredItem, day: string) =>
  item.createdDay <= day && (item.archivedDay === null || day < item.archivedDay);

/** Shown on that day's sheet (pending ones too; rejected never). */
export const shownOn = (item: ScoredItem, day: string) =>
  item.status !== "REJECTED" && isActiveOn(item.days, day) && existsOn(item, day);

/** Counts toward that day's score: approved, active that weekday, existing that day. */
export const countsOn = (item: ScoredItem, day: string) => item.status === "APPROVED" && item.value !== null && shownOn(item, day);

export interface DayScore {
  day: string;
  possible: number;
  earned: number;
}

/** checked: the item ids she ticked that day. Calculated, never stored. */
export function dayScore(items: ScoredItem[], checked: Set<string>, day: string): DayScore {
  let possible = 0;
  let earned = 0;
  for (const item of items) {
    if (!countsOn(item, day)) continue;
    possible += item.value!;
    if (checked.has(item.id)) earned += item.value!;
  }
  return { day, possible, earned };
}

export const isComplete = (s: DayScore) => s.possible > 0 && s.earned >= s.possible;

/** «كل يوم» or the chosen weekdays, Sunday first. */
export function daysLabel(days: number): string {
  if (days === EVERY_DAY) return "كل يوم";
  return WEEKDAY_LABELS.filter((_, i) => (days & (1 << i)) !== 0).join("، ");
}

/** The viewer's local calendar day of a timestamp (browser time zone). */
export function localDayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Browser-side: an item exists from the viewer's local day it was created
 * (and stops on the local day it was archived), not the UTC one — so an item
 * added just after local midnight doesn't reach back into yesterday.
 */
export function withLocalDays<T extends ScoredItem & { createdAt: string; archivedAt: string | null }>(items: T[]): T[] {
  return items.map((i) => ({ ...i, createdDay: localDayOf(i.createdAt), archivedDay: i.archivedAt ? localDayOf(i.archivedAt) : null }));
}
