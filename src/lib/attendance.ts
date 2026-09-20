export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
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
