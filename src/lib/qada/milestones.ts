// «القضاء»: the milestones (25%, 50%, 75%, 100%), each shown once, apart for
// the prayers and for fasting. Pure.
//
// shown: the highest already shown; at: the owed total then. Only the
// highest milestone just reached is shown (no row of them after a big
// step). When more owed is added after 100%, the line starts again from
// where she is now, quietly, so 100% can be celebrated again later; a share
// that drops for any other reason never brings an old one back.

export const MILESTONES = [25, 50, 75, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

export type MilestoneState = { shown: number; at: number };

const reached = (pct: number): number => MILESTONES.filter((m) => pct >= m - 1e-9).at(-1) ?? 0;

/** The milestone to show now (null: none), and the state to keep once it's shown. */
export function nextMilestone(pct: number, owed: number, state: MilestoneState): { show: Milestone | null; state: MilestoneState } {
  if (owed === 0) return { show: null, state };
  let s = state;
  // more owed after the end: begin again from where she is
  if (s.shown === 100 && owed > s.at) s = { shown: reached(pct), at: owed };
  const r = reached(pct);
  if (r > s.shown) return { show: r as Milestone, state: { shown: r, at: owed } };
  return { show: null, state: s };
}
