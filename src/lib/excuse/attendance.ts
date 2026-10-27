import { weekIndex } from "@/lib/students/streak";

// «أيام العذر» in a course's attendance (girls groups): «معذورة» is neither
// presence nor absence. Pure.

export type AttendanceWithExcuse = "IN" | "OUT" | "PENDING" | "EXCUSED";

/**
 * Her weeks that are neutral for the weekly streak: a day marked «معذورة»
 * and none marked absent. (A week she qualified in counts whatever else it
 * holds; computeStreak looks at those first.)
 */
export function excusedWeeks(logs: { day: Date; status: AttendanceWithExcuse }[]): Set<number> {
  const excused = new Set<number>();
  const absent = new Set<number>();
  for (const l of logs) {
    if (l.status === "EXCUSED") excused.add(weekIndex(l.day));
    else if (l.status === "OUT") absent.add(weekIndex(l.day));
  }
  for (const w of absent) excused.delete(w);
  return excused;
}

/** Her paused days for the memorization goal: the days marked «معذورة» ("YYYY-MM-DD"). */
export const excusedDays = (logs: { day: Date; status: AttendanceWithExcuse }[]): Set<string> =>
  new Set(logs.filter((l) => l.status === "EXCUSED").map((l) => l.day.toISOString().slice(0, 10)));
