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
//  - A paused day («أيام العذر» with «إيقاف الحفظ أيضًا») is a day off: it
//    never breaks the streak, and a session on it still counts.
//  - Today never breaks it: until she logs today, the streak runs to
//    yesterday. (Sessions can be backdated two days at most, so a missed
//    day can only be filled within that window.)

export type CommitSchedule = { from: string; days: number }[];

/**
 * Her first day: the day she signed up (createdDay, her own local day), or
 * the day of a session backdated before it — it still counts from its day.
 * loggedDays: sorted.
 */
export function commitStart(loggedDays: string[], createdDay: string): string {
  return loggedDays.length && loggedDays[0] < createdDay ? loggedDays[0] : createdDay;
}

/** Her intended weekdays on a given day (no schedule yet = every day). */
export function scheduledDays(schedule: CommitSchedule, day: string): number {
  let days = EVERY_DAY;
  for (const s of schedule) if (s.from <= day) days = s.days;
  return days;
}

export const isCommitDay = (schedule: CommitSchedule, day: string) => isActiveOn(scheduledDays(schedule, day), day);

/**
 * schedule: sorted by `from`; logged: her days with a logged session;
 * start: her first day (no day before it can break anything); paused: her
 * paused days (pausedDays, src/lib/excuse/rules.ts).
 */
export function computeStreak(
  schedule: CommitSchedule,
  logged: Set<string>,
  today: string,
  start: string,
  paused: Set<string> = new Set(),
): { current: number; best: number } {
  const breaks = (d: string) => isCommitDay(schedule, d) && !paused.has(d);
  // current: back from today
  let current = 0;
  for (let d = today; d >= start; d = addDays(d, -1)) {
    if (logged.has(d)) current++;
    else if (d === today) continue; // still in progress
    else if (breaks(d)) break;
  }

  // best: one pass forward from her first day
  let best = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (logged.has(d)) run++;
    else if (d !== today && breaks(d)) run = 0;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

export type WeekDayState = "done" | "missed" | "off" | "today" | "future" | "before";

/** Sunday–Saturday of this week, each with its state (a paused day shows as a day off). */
export function weekView(
  schedule: CommitSchedule,
  logged: Set<string>,
  today: string,
  start: string,
  paused: Set<string> = new Set(),
): { day: string; state: WeekDayState }[] {
  return weekDays(today).map((day) => {
    const state: WeekDayState = logged.has(day)
      ? "done"
      : day > today
        ? "future"
        : day < start
          ? "before"
          : day === today
            ? "today"
            : isCommitDay(schedule, day) && !paused.has(day)
              ? "missed"
              : "off";
    return { day, state };
  });
}

const DAYS: CountForms = { one: "يوم واحد", two: "يومان", few: "أيام", many: "يومًا" };

/** «يوم واحد»، «يومان»، «3 أيام»، «11 يومًا» — consecutive days. */
export const streakDaysText = (n: number) => countLabel(n, DAYS);
