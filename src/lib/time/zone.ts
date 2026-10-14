// A course's days are counted in its own time zone (Course.timeZone,
// Asia/Riyadh unless the supervisor changes it in «التوقيت»): «today», day
// boundaries, weeks, deadlines, the day a recitation happened. Never the
// server's clock zone (UTC on Vercel). «رفيق الحفظ» is not a course: it
// keeps using her own browser's day (lib/calendar/useToday.ts).
//
// A day is passed around as "YYYY-MM-DD". Date-only columns (attendance,
// points, ticks…) store it as UTC midnight of that day, with no shift — this
// module never changes what a stored day means; it only decides which day
// "now", or an instant such as occurredAt, falls on. Client-safe, pure.

export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormats = new Map<string, Intl.DateTimeFormat>();
const partFormats = new Map<string, Intl.DateTimeFormat>();

function dayFormat(tz: string): Intl.DateTimeFormat {
  let f = dayFormats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormats.set(tz, f);
  }
  return f;
}

/** A real IANA zone this runtime knows (e.g. "Asia/Riyadh"). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !/^[A-Za-z][A-Za-z0-9_+\-/]{1,63}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The stored zone, or Riyadh if it's missing or unknown to this runtime. */
export const safeTimeZone = (tz: string | null | undefined): string => (isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE);

/** "YYYY-MM-DD" of the day this instant falls on in the zone. */
export function zoneDayOf(tz: string, instant: Date): string {
  return dayFormat(tz).format(instant);
}

/** "YYYY-MM-DD" of today in the zone. */
export function zoneToday(tz: string, now: Date = new Date()): string {
  return zoneDayOf(tz, now);
}

/** "YYYY-MM-DD" → its date-only value (UTC midnight). Assumes a valid day. */
export const dateOnly = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** Date-only value → "YYYY-MM-DD". */
export const isoOf = (d: Date): string => d.toISOString().slice(0, 10);

/** Today in the zone, as a date-only value (what attendance and points store). */
export const zoneDateOnly = (tz: string, now: Date = new Date()): Date => dateOnly(zoneToday(tz, now));

/** The instant's zone day, as a date-only value. */
export const zoneDateOnlyOf = (tz: string, instant: Date): Date => dateOnly(zoneDayOf(tz, instant));

export const addDaysISO = (iso: string, n: number): string => isoOf(new Date(dateOnly(iso).getTime() + n * DAY_MS));

/** Minutes the zone is ahead of UTC at this instant (Riyadh: 180). */
export function zoneOffsetMinutes(tz: string, instant: Date): number {
  let f = partFormats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partFormats.set(tz, f);
  }
  const parts = f.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const exact = instant.getTime() - instant.getUTCMilliseconds();
  return Math.round((wall - exact) / 60000);
}

/** "+03:00", "-05:30", "+00:00" */
export function zoneOffsetLabel(tz: string, now: Date = new Date()): string {
  const m = zoneOffsetMinutes(tz, now);
  const abs = Math.abs(m);
  return `${m < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * The instant this day starts in the zone (its first moment that belongs
 * to it — later than local midnight where a clock change skips midnight).
 */
export function zoneDayStart(tz: string, iso: string): Date {
  const midnight = dateOnly(iso).getTime();
  let t = midnight - zoneOffsetMinutes(tz, new Date(midnight)) * 60000;
  t = midnight - zoneOffsetMinutes(tz, new Date(t)) * 60000;
  // a clock change can leave the guess on a neighbouring day: step to the edge
  for (let i = 0; i < 4 && zoneDayOf(tz, new Date(t)) < iso; i++) t += 60 * 60000;
  for (let i = 0; i < 4 && zoneDayOf(tz, new Date(t - 60 * 60000)) === iso; i++) t -= 60 * 60000;
  // now within the right hour: settle on the exact first minute
  while (zoneDayOf(tz, new Date(t - 60000)) === iso) t -= 60000;
  return new Date(t);
}

/** [start, end) of this zone day, for querying instants (occurredAt…). */
export function zoneDayRange(tz: string, fromIso: string, toIso: string = fromIso): { gte: Date; lt: Date } {
  return { gte: zoneDayStart(tz, fromIso), lt: zoneDayStart(tz, addDaysISO(toIso, 1)) };
}

/**
 * When a backdated entry is stored: noon UTC of its day, as always — that
 * instant falls on the same day everywhere from UTC−11 to UTC+11. A zone
 * further out (e.g. Pacific/Auckland, Pacific/Tongatapu) uses its own local
 * noon instead, so the entry still lands on its day there.
 */
export function backdatedAt(tz: string, day: Date | string): Date {
  const iso = typeof day === "string" ? day : isoOf(day);
  const noonUtc = new Date(`${iso}T12:00:00Z`);
  const offset = zoneOffsetMinutes(tz, noonUtc);
  if (Math.abs(offset) <= 11 * 60) return noonUtc;
  return new Date(noonUtc.getTime() - zoneOffsetMinutes(tz, new Date(noonUtc.getTime() - offset * 60000)) * 60000);
}
