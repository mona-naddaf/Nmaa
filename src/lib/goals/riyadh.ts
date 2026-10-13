// Courses count goal days in Riyadh time, as attendance does
// (lib/attendance.ts): "YYYY-MM-DD" of the Riyadh day an instant falls on.

const RIYADH_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });

export const riyadhDay = (d: Date = new Date()) => RIYADH_DAY.format(d);
