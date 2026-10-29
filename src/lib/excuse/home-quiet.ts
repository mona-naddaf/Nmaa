import { neutralGoal, type GoalSession, type GoalSpec, type GoalView } from "@/lib/goals/goal";
import { commitStart, computeStreak, weekView, type CommitSchedule, type WeekDayState } from "@/lib/rafiq/streak";
import { addDays } from "@/lib/tracker/rules";
import { pausedDays } from "./rules";

// «أيام العذر» on a girl's «صفحتي» for an adult who may not see her excuse:
// her 🔥, this week and her goal as results only, for each day that may be
// the viewer's today (yesterday, today and tomorrow by the server's clock),
// as the family's dashboard does (dashboard-build.ts resultsOf). Paused days
// are days off for 🔥 (shown as any day off); on them her goal stays as it
// was before the pause (neutralGoal). The paused days never leave the
// server. Pure.

export type QuietHome = {
  goalBy: Record<string, GoalView | null>;
  streakBy: Record<string, { current: number; best: number; week: { day: string; state: WeekDayState }[] }>;
};

export function quietHome(
  home: { plan: number[]; goal: GoalSpec | null; sessions: GoalSession[]; schedule: CommitSchedule; loggedDays: string[]; createdAt: string },
  pauses: { from: string; to: string | null }[],
  serverToday: string,
): QuietHome {
  const logged = new Set(home.loggedDays);
  const start = commitStart(home.loggedDays, home.createdAt.slice(0, 10));
  const out: QuietHome = { goalBy: {}, streakBy: {} };
  for (const d of [-1, 0, 1].map((n) => addDays(serverToday, n))) {
    const paused = pausedDays(pauses, d);
    out.goalBy[d] = home.goal ? neutralGoal(home.plan, home.goal, home.sessions, d, paused) : null;
    out.streakBy[d] = { ...computeStreak(home.schedule, logged, d, start, paused), week: weekView(home.schedule, logged, d, start, paused) };
  }
  return out;
}
