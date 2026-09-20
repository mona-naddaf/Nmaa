export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// "YYYY-MM-DD", the format a native <input type="date"> uses
export function todayISO(): string {
  return todayDateOnly().toISOString().slice(0, 10);
}

// parses a "YYYY-MM-DD" string (as produced by a native <input type="date">)
// into a UTC date-only value, rejecting anything malformed or in the future
export function parseDateOnlyInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
  if (parsed.getTime() > todayDateOnly().getTime()) return null;
  return parsed;
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export type AttendanceStatus = "IN" | "OUT" | "PENDING";

// attendance is a per-day value; if the stored day isn't today it reads as
// PENDING rather than being reset by a cron job
export function effectiveAttendance(status: AttendanceStatus, day: Date | null): AttendanceStatus {
  if (!day || !sameDate(day, todayDateOnly())) return "PENDING";
  return status;
}
