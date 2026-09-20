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

export type AttendanceStatus = "IN" | "OUT" | "PENDING";

// AttendanceLog is append-only, one row per student per day; a day with no
// row is implicitly PENDING (nothing to reset — there's simply no entry yet)
export function attendanceStatusForDay(
  logs: { day: Date; status: AttendanceStatus }[],
  day: Date,
): AttendanceStatus {
  const match = logs.find((l) => l.day.getTime() === day.getTime());
  return match?.status ?? "PENDING";
}
