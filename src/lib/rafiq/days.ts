import { acceptLocalDay } from "@/lib/home-log/rules";
import { addDays } from "@/lib/tracker/rules";

// Her sessions are dated by her own local calendar day (her browser reports
// it; the server only checks it's within a day of its own UTC date). She may
// log today or up to two days back — never the future.

export const BACKDATE_DAYS = 2;

/** today, yesterday, the day before — newest first. */
export function loggableDays(today: string): string[] {
  return Array.from({ length: BACKDATE_DAYS + 1 }, (_, i) => addDays(today, -i));
}

/** The session's day if she may log it, else null. */
export function acceptSessionDay(dayInput: unknown, todayInput: unknown, now: Date = new Date()): string | null {
  const today = acceptLocalDay(String(todayInput ?? ""), now);
  if (!today || typeof dayInput !== "string") return null;
  return loggableDays(today).includes(dayInput) ? dayInput : null;
}

/**
 * When it happened, for ordering: now for today; a backdated day is pinned to
 * noon UTC of that day (as course sessions are), so it sorts within its day.
 */
export function occurredAtFor(day: string, today: string, now: Date = new Date()): Date {
  return day === today ? now : new Date(`${day}T12:00:00Z`);
}
