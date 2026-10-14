// Dates in «التسميع بدون إنترنت». A sheet's date is a calendar day with no
// time and no timezone: what the teacher wrote is what's saved, as the same
// UTC-midnight "date-only" value the rest of the app stores (attendance
// days, points days), with no shift.
//
// "Today" here is the course's today, in its time zone (lib/time/zone.ts),
// not the server's UTC day. A file may be dated up to today and as far back
// as MAX_DAYS_BACK days. Client-safe.

import { backdatedAt, zoneToday } from "@/lib/time/zone";

export const MAX_DAYS_BACK = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" → the date-only value (UTC midnight of that day), or null if not a real date. */
export function isoToDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export const dateOnlyToISO = (d: Date) => d.toISOString().slice(0, 10);

/** Why this day can't be a sheet's date, or null when it can. */
export function sheetDateProblem(day: Date, timeZone: string, now: Date = new Date()): string | null {
  const today = isoToDateOnly(zoneToday(timeZone, now))!;
  if (day.getTime() > today.getTime()) return "تاريخ الملف في المستقبل";
  if (today.getTime() - day.getTime() > MAX_DAYS_BACK * DAY_MS) {
    return `تاريخ الملف أقدم من ${MAX_DAYS_BACK} يومًا؛ لا يمكن رفع ملف بتاريخ أقدم من ذلك`;
  }
  return null;
}

/**
 * The time a sheet's sessions are stored at, i-th of the day (to keep their
 * order), like the form: the course's today: now. A past day: when a
 * backdated entry on the form is stored (backdatedAt: noon UTC of it).
 */
export function sheetOccurredAt(day: Date, i: number, timeZone: string, now: Date = new Date()): Date {
  if (dateOnlyToISO(day) === zoneToday(timeZone, now)) return new Date(now.getTime() + i);
  return new Date(backdatedAt(timeZone, day).getTime() + i * 1000);
}

/**
 * A date cell as written: an Excel date (read as its UTC calendar day, which
 * is exactly what was typed), its serial number, or text — «2026-10-09» or
 * day first «9/10/2026». null when it isn't one of those.
 */
export function readSheetDate(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel's serial day 25569 is 1970-01-01
    return new Date(Math.round(value - 25569) * DAY_MS);
  }
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (iso) return isoToDateOnly(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`);
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (dmy) return isoToDateOnly(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);
  return null;
}
