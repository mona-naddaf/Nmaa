import { daysBetween } from "@/lib/calendar/hijri";
import { availableDays, type ExcuseSpan } from "./available";
import { fastPaceFinish, fastPerWeek, prayerPaceFinish, prayerPaceToday, prayerQuota, standing } from "./distribute";
import { fastSuggestions, type FastSuggestion } from "./fasting-days";
import { PRAYERS, type PrayerKind, type QadaAction, type QadaKind } from "./kinds";
import { remainingOf } from "./totals";

// «القضاء»: what the card shows of each goal today — the whole plan,
// worked out from the log and the goal. Pure. Only ever built for a viewer
// who may see the plan (visibility.ts).

export type GoalMode = "NONE" | "DEADLINE" | "PACE";

export type Goal = {
  mode: GoalMode;
  deadline: string | null;
  pace: number | null;
  // the day it was set, and its amount then (per day: prayers; per week: fasting)
  from: string | null;
  baseline: number | null;
};

export type DayRow = { kind: QadaKind; action: QadaAction; count: number; day: string | null };

export type PlanContext = {
  today: string;
  // her average excuse days per month; null: none (a man, or not given)
  avg: number | null;
  // her recorded excuses; null: she doesn't record them
  excuses: ExcuseSpan[] | null;
  // an excuse is open now: no amount for today
  excuseNow: boolean;
  // fasting: the days left out from today on (fasting-days.ts)
  blocked: Set<string>;
};

export type PrayerPlan = {
  mode: GoalMode;
  deadline: string | null;
  pace: number | null;
  // today's amount and what's done of it today; null: none today (no goal
  // with an amount, nothing left, or her excuse now)
  today: { per: Record<PrayerKind, number>; done: Record<PrayerKind, number>; total: number } | null;
  // «وتيرة»: the estimated last day
  finish: string | null;
  standing: "ahead" | "extend" | "even";
  // the amount now (per day), kept as the goal's start when it's set
  rate: number;
};

export type FastPlan = {
  mode: GoalMode;
  deadline: string | null;
  pace: number | null;
  // «موعد»: days per week (unrounded); null otherwise or nothing left
  perWeek: number | null;
  finish: string | null;
  // the next suggested days (none during her excuse or with nothing left)
  suggestions: FastSuggestion[];
  standing: "ahead" | "extend" | "even";
  rate: number;
};

const before = (rows: DayRow[], today: string) => rows.filter((r) => r.action === "OWED" || (r.day !== null && daysBetween(r.day, today) > 0));

export function prayerPlan(rows: DayRow[], goal: Goal, c: PlanContext): PrayerPlan {
  // the start of today: made-up entries of today don't change today's amount
  const startLeft = remainingOf(before(rows, c.today));
  const left = Object.fromEntries(PRAYERS.map((p) => [p, startLeft[p]])) as Record<PrayerKind, number>;
  const done = Object.fromEntries(PRAYERS.map((p) => [p, 0])) as Record<PrayerKind, number>;
  for (const r of rows) if (r.action === "MADE_UP" && r.day === c.today && r.kind !== "FAST") done[r.kind] += r.count;
  const base = { mode: goal.mode, deadline: goal.deadline, pace: goal.pace, finish: null, standing: "even" as const, rate: 0, today: null };

  if (goal.mode === "DEADLINE" && goal.deadline) {
    const av = availableDays({ today: c.today, deadline: goal.deadline, from: goal.from ?? c.today, avg: c.avg, excuses: c.excuses });
    const q = prayerQuota(left, av.days);
    return {
      ...base,
      rate: q.rate,
      standing: standing(q.rate, goal.baseline),
      today: c.excuseNow || q.total === 0 ? null : { per: q.per, done, total: q.total },
    };
  }
  if (goal.mode === "PACE" && goal.pace) {
    const q = prayerPaceToday(left, goal.pace);
    return {
      ...base,
      rate: q.total,
      finish: prayerPaceFinish(left, goal.pace, c.today, c.avg),
      today: c.excuseNow || q.total === 0 ? null : { per: q.per, done, total: q.total },
    };
  }
  return base;
}

export function fastPlan(rows: DayRow[], goal: Goal, c: PlanContext): FastPlan {
  const left = remainingOf(before(rows, c.today)).FAST;
  const base = { mode: goal.mode, deadline: goal.deadline, pace: goal.pace, perWeek: null, finish: null, standing: "even" as const, rate: 0 };
  // suggestions: two weeks ahead, never during her excuse
  const suggestions = left > 0 && !c.excuseNow && goal.mode !== "NONE" ? fastSuggestions(c.today, 14, c.blocked) : [];

  if (goal.mode === "DEADLINE" && goal.deadline) {
    const av = availableDays({ today: c.today, deadline: goal.deadline, from: goal.from ?? c.today, avg: c.avg, excuses: c.excuses, blocked: c.blocked });
    const perWeek = fastPerWeek(left, av.days, c.avg);
    return { ...base, rate: perWeek, perWeek: left > 0 ? perWeek : null, standing: standing(perWeek, goal.baseline), suggestions };
  }
  if (goal.mode === "PACE" && goal.pace) {
    return { ...base, rate: goal.pace, finish: fastPaceFinish(left, goal.pace, c.today, c.avg, (d) => c.blocked.has(d)), suggestions };
  }
  return { ...base, suggestions: [] };
}
