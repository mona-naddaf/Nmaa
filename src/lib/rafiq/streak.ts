import { addDays, EVERY_DAY, isActiveOn, weekDays } from "@/lib/tracker/rules";
import { countLabel, type CountForms } from "@/lib/text/count";

// Commitment days («أيام الالتزام») for «رفيق الحفظ». Pure and client-safe:
// the page computes it in her browser, on her own local "today".
//
// Rules:
//  - A day counts as committed when she logged any session that day (new,
//    review or linking; memorization from before doesn't count).
//  - She picks the weekdays she intends to commit to. A change applies from
//    the day she makes it, so past days keep the schedule they had.
//  - A missed day she intended to commit to breaks the streak; a day off
//    never does. A session on a day off still counts toward the streak.
//  - Today never breaks it: until she logs today, the streak runs to
//    yesterday. (Sessions can be backdated two days at most, so a missed
//    day can only be filled within that window.)

export type CommitSchedule = { from: string; days: number }[];

/** Her intended weekdays on a given day (no schedule yet = every day). */
export function scheduledDays(schedule: CommitSchedule, day: string): number {
  let days = EVERY_DAY;
  for (const s of schedule) if (s.from <= day) days = s.days;
  return days;
}

export const isCommitDay = (schedule: CommitSchedule, day: string) => isActiveOn(scheduledDays(schedule, day), day);

/**
 * schedule: sorted by `from`; logged: her days with a logged session;
 * start: her first day (no day before it can break anything).
 */
export function computeStreak(schedule: CommitSchedule, logged: Set<string>, today: string, start: string): { current: number; best: number } {
  // current: back from today
  let current = 0;
  for (let d = today; d >= start; d = addDays(d, -1)) {
    if (logged.has(d)) current++;
    else if (d === today) continue; // still in progress
    else if (isCommitDay(schedule, d)) break;
  }

  // best: one pass forward from her first day
  let best = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (logged.has(d)) run++;
    else if (d !== today && isCommitDay(schedule, d)) run = 0;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

export type WeekDayState = "done" | "missed" | "off" | "today" | "future" | "before";

/** Sunday–Saturday of this week, each with its state. */
export function weekView(schedule: CommitSchedule, logged: Set<string>, today: string, start: string): { day: string; state: WeekDayState }[] {
  return weekDays(today).map((day) => {
    const state: WeekDayState = logged.has(day)
      ? "done"
      : day > today
        ? "future"
        : day < start
          ? "before"
          : day === today
            ? "today"
            : isCommitDay(schedule, day)
              ? "missed"
              : "off";
    return { day, state };
  });
}

const DAYS: CountForms = { one: "يوم واحد", two: "يومان", few: "أيام", many: "يومًا" };

/** «يوم واحد»، «يومان»، «3 أيام»، «11 يومًا» — consecutive days. */
export const streakDaysText = (n: number) => countLabel(n, DAYS);
