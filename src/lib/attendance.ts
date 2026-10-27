import { zoneDateOnly } from "@/lib/time/zone";

// A course's "today" and day boundaries come from its time zone
// (lib/time/zone.ts: zoneDateOnly, zoneToday…): attendance, points and the
// recording form all use the same day, after midnight too.

// parses a "YYYY-MM-DD" string (as produced by a native <input type="date">)
// into a UTC date-only value, rejecting anything malformed or after today in
// the course's time zone
export function parseDateOnlyInput(raw: string, timeZone: string, now: Date = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
  if (parsed.getTime() > zoneDateOnly(timeZone, now).getTime()) return null;
  return parsed;
}

// EXCUSED: «معذورة» («أيام العذر», girls groups; src/lib/excuse/attendance.ts)
export type AttendanceStatus = "IN" | "OUT" | "PENDING" | "EXCUSED";

// AttendanceLog is append-only, one row per student per day; a day with no
// row is implicitly PENDING (nothing to reset — there's simply no entry yet)
export function attendanceStatusForDay(
  logs: { day: Date; status: AttendanceStatus }[],
  day: Date,
): AttendanceStatus {
  const match = logs.find((l) => l.day.getTime() === day.getTime());
  return match?.status ?? "PENDING";
}
