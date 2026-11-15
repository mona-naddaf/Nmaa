import { addDays, daysBetween } from "@/lib/calendar/hijri";
import { DAYS_PER_MONTH } from "./estimate";

// «القضاء» Phase 2: her cycle, predicted from her «أيام العذر» records. Pure.
//
// Rules (Mona, 2026-11-16): at least 3 complete cycles — 4 recorded excuses,
// the last 3 of them ended — before anything is predicted. The cycle is the
// median of the last 6 gaps between starts, the duration the median of the
// last 6 durations: one unusual month doesn't move it. A gap outside 15–60
// days is a hole in her records, not a cycle; an excuse that ended by itself
// after 15 days has no real duration (its start still counts). Private: the
// same visibility as her excuse.

export type ExcuseRecord = {
  // her days, both ends included; end null: still open
  start: string;
  end: string | null;
  // ended by itself (after 15 days)
  auto: boolean;
};

export type CyclePrediction = {
  // days from one start to the next, and how long one lasts
  cycle: number;
  duration: number;
  // the last start, the base of the next windows
  lastStart: string;
};

export const CYCLE_LIMITS = { minCycles: 3, minRecords: 4, last: 6, minGap: 15, maxGap: 60, maxDuration: 15 } as const;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function predictCycle(records: ExcuseRecord[]): CyclePrediction | null {
  const rs = [...records].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  if (rs.length < CYCLE_LIMITS.minRecords) return null;
  // the last 3 of them ended
  if (rs.slice(0, -1).slice(-CYCLE_LIMITS.minCycles).some((r) => r.end === null)) return null;
  const gaps: number[] = [];
  for (let i = 1; i < rs.length; i++) {
    const g = daysBetween(rs[i - 1].start, rs[i].start);
    if (g >= CYCLE_LIMITS.minGap && g <= CYCLE_LIMITS.maxGap) gaps.push(g);
  }
  const durations = rs
    .filter((r) => r.end !== null && !r.auto)
    .map((r) => daysBetween(r.start, r.end!) + 1)
    .filter((d) => d >= 1 && d <= CYCLE_LIMITS.maxDuration);
  if (gaps.length < CYCLE_LIMITS.minCycles || durations.length < CYCLE_LIMITS.minCycles) return null;
  return { cycle: median(gaps.slice(-CYCLE_LIMITS.last)), duration: median(durations.slice(-CYCLE_LIMITS.last)), lastStart: rs[rs.length - 1].start };
}

/** Her excuse days per 30 days, from a prediction (the plan's excuse-aware maths uses it in place of her own number). */
export const monthlyFromCycle = (p: CyclePrediction) => Math.min(DAYS_PER_MONTH - 1, (p.duration * DAYS_PER_MONTH) / p.cycle);

/** The predicted excuse days between from and to (both included), after her last start. */
export function predictedDays(p: CyclePrediction, from: string, to: string): Set<string> {
  const out = new Set<string>();
  if (daysBetween(from, to) < 0) return out;
  for (let k = 1; k < 1000; k++) {
    const start = addDays(p.lastStart, k * p.cycle);
    if (daysBetween(to, start) > 0) break;
    for (let i = 0; i < p.duration; i++) {
      const d = addDays(start, i);
      if (daysBetween(from, d) >= 0 && daysBetween(d, to) >= 0) out.add(d);
    }
  }
  return out;
}
