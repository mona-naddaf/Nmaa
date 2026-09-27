// Weekly streaks: how many consecutive weeks a student has qualified — by
// attendance or by recitation, per the course's streakMode — ending at the
// most recent week. Pure and client-safe; the data loading lives in
// streak-data.ts.
//
// Rules:
//  - Weeks are calendar weeks starting on Sunday, on the same UTC calendar
//    days the rest of the app uses (attendance days, session dates).
//  - The current week never breaks a streak: if she hasn't qualified yet this
//    week, the streak simply runs to last week.
//  - A week in which nobody in her group qualified (no class — Eid, a
//    holiday, a cancelled session) is neutral: it neither counts nor breaks.
//    Groups meet on different days, so this is judged per group.
//  - Nothing is stored: it's recomputed from the logs every time, so a
//    backdated session counts toward the week it's dated in.

export type StreakMode = "ATTENDANCE" | "RECITATION";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sunday-based week number of a date's UTC calendar day. 1970-01-01 was a
 * Thursday, so shifting by 4 days puts every Sunday on a multiple of 7.
 */
export function weekIndex(date: Date): number {
  return Math.floor((Math.floor(date.getTime() / DAY_MS) + 4) / 7);
}

/**
 * @param studentWeeks weeks in which the student qualified
 * @param groupWeeks   weeks in which anyone in her group qualified (includes hers)
 * @param currentWeek  weekIndex(today)
 */
export function computeStreak(studentWeeks: Set<number>, groupWeeks: Set<number>, currentWeek: number): number {
  if (studentWeeks.size === 0) return 0;
  const earliest = Math.min(...groupWeeks);
  let streak = 0;
  for (let w = currentWeek; w >= earliest; w--) {
    if (studentWeeks.has(w)) streak++;
    else if (w === currentWeek) continue; // still in progress
    else if (!groupWeeks.has(w)) continue; // neutral: no class that week
    else break;
  }
  return streak;
}

/** The streak as a phrase, with Arabic number/adjective agreement. */
export function streakText(n: number): string {
  if (n === 0) return "لا أسابيع متتالية بعد";
  if (n === 1) return "أسبوع واحد";
  if (n === 2) return "أسبوعان متتاليان";
  return n <= 10 ? `${n} أسابيع متتالية` : `${n} أسبوعًا متتاليًا`;
}

export const STREAK_MODE_LABEL: Record<StreakMode, string> = {
  ATTENDANCE: "حضور",
  RECITATION: "تسميع",
};
