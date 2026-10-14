import { zoneDayOf } from "./zone";

// How a date reaches the viewer (pure; the browser-day parts only make sense
// in her browser): see ShownDay and useToday.

const pad = (n: number) => String(n).padStart(2, "0");

/** The day an instant (ISO string) falls on: in the course's zone, or (no zone: «رفيق الحفظ») the browser's. */
export function dayOfInstant(iso: string, tz: string | null): string {
  if (tz) return zoneDayOf(tz, new Date(iso));
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A stored day ("YYYY-MM-DD") as it is; a timestamp (ISO) as dayOfInstant. */
export function shownDay(value: string, tz: string | null): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dayOfInstant(value, tz);
}
