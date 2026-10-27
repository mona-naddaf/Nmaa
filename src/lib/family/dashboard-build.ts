// «عائلتي» (step 5): what one person sees of her family — pure (no DB), so
// the rules and the shape of what leaves the server are unit-tested
// (dashboard-build.test.ts). The loader (dashboard.ts) queries only what
// dashboardSections allows, then builds the cards here.
//
// - An adult of the family sees every child (position, recorded today,
//   today's tracker), and each adult only for what she shares.
// - A child sees her siblings only while the founder has «يرى الأطفال تقدّم
//   إخوتهم» on (the same three facts), and the adults who share.
// - What an adult shares: «مشاركة تقدّمي» — position, memorized pages, recorded
//   today, last session, her goal (if she has one) and her streak;
//   «مشاركة جدولي» — completion only (today's and the last days'), never an
//   item's title or which item was ticked: items leave the server as
//   anonymous scored rows.

import { deriveCurrentPosition, deriveReach } from "@/lib/recitation/logic";
import { buildCoverage, coveredQuranPages } from "@/lib/students/progress";
import { forPosition } from "@/lib/rafiq/position";
import type { ScoredItem } from "@/lib/tracker/rules";
import { computeGoal, type GoalSession, type GoalSpec, type GoalView } from "@/lib/goals/goal";
import { commitStart, computeStreak } from "@/lib/rafiq/streak";
import type { CommitmentData } from "@/lib/rafiq/commitment";

export type DashViewer = { kind: "ADULT" | "CHILD"; id: string };

export type PersonRow = {
  id: string;
  name: string | null;
  gender: "MALE" | "FEMALE";
  createdAt: Date;
  planChangedAt: Date | null;
};
export type AdultRow = PersonRow & { shareProgress: boolean; shareTracker: boolean };

export type DashFacts = { familyId: string; siblingsVisible: boolean; children: PersonRow[]; adults: AdultRow[] };

/** Whose data may be queried at all for this viewer. */
export function dashboardSections(viewer: DashViewer, facts: DashFacts) {
  const childIds =
    viewer.kind === "ADULT" ? facts.children.map((c) => c.id) : facts.siblingsVisible ? facts.children.filter((c) => c.id !== viewer.id).map((c) => c.id) : [];
  const progressAdultIds = facts.adults.filter((a) => a.shareProgress).map((a) => a.id);
  const trackerAdultIds = facts.adults.filter((a) => a.shareTracker).map((a) => a.id);
  return {
    childIds,
    progressAdultIds,
    trackerAdultIds,
    // sessions and plans: the children shown and the adults sharing progress
    sessionSubjects: [...childIds, ...progressAdultIds],
    trackerSubjects: [...childIds, ...trackerAdultIds],
  };
}

export type DashRows = {
  planItems: { userId: string; surahNumber: number; position: number }[];
  sessions: {
    userId: string;
    source: "LOGGED" | "PRIOR";
    type: "NEW" | "REVIEW" | "LINK";
    surahNumber: number;
    fromAyah: number;
    toAyah: number;
    situation: "CONTINUE" | "NEXT" | "SURAH_GAP" | "AYAH_GAP" | "EDIT" | null;
    reason: string | null;
    createdAt: Date;
    day: Date;
  }[];
  goals: { userId: string; target: "PLAN" | "JUZ" | "POINT"; juz: number | null; surah: number | null; ayah: number | null; startDay: Date; deadline: Date }[];
  commitDays: { userId: string; days: number; effectiveFrom: Date }[];
  trackerItems: { id: string; userId: string; value: number; days: number; createdAt: Date; archivedAt: Date | null }[];
  checks: { userId: string; itemId: string; day: Date }[];
  // «أيام العذر»: per person, the «day:itemId» pairs not counted (keyOf,
  // src/lib/excuse/rules.ts). Used here only: what leaves the server is the
  // scores without them, never the pairs or the days.
  skipped?: Record<string, string[]>;
  // «أيام العذر» on: per woman sharing her progress, her paused days (maybe
  // none). Her card then carries her 🔥 and goal worked out here, never the
  // days themselves (resultsOf).
  paused?: Record<string, string[]>;
};

// a scored row without its title (it never leaves the server)
export type DashItem = ScoredItem & { createdAt: string; archivedAt: string | null };

export type DashProgress = {
  // null: hasn't started; firstSurah: the first surah of her plan
  position: { surahNumber: number; ayah: number } | null;
  firstSurah: number | null;
  // the days she recorded a session (newest last); the viewer picks "today"
  loggedDays: string[];
  // adults sharing progress only
  memorizedPages?: number;
  goal?: { plan: number[]; spec: GoalSpec; sessions: GoalSession[] } | null;
  streak?: CommitmentData;
  // instead of goal / streak («أيام العذر» on, a woman): the results for each
  // day that may be the viewer's today (the server doesn't know her zone)
  goalBy?: Record<string, GoalView | null>;
  streakBy?: Record<string, { current: number; best: number }>;
};

export type DashCard = {
  // opaque, for React lists
  key: string;
  kind: "CHILD" | "ADULT";
  name: string;
  gender: "MALE" | "FEMALE";
  isMe: boolean;
  // an adult viewer's link to a child's page
  href?: string;
  progress?: DashProgress;
  // todayOnly: a sibling's card — today's completion, nothing of the days before
  tracker?: { items: DashItem[]; checks: Record<string, string[]>; todayOnly?: boolean };
};

export type DashboardData = { children: DashCard[]; adults: DashCard[] };

const day = (d: Date) => d.toISOString().slice(0, 10);
// a child's card needs only the latest days (recorded today, last session)
const CHILD_DAYS = 10;

function planOf(rows: DashRows, userId: string): number[] {
  return rows.planItems
    .filter((p) => p.userId === userId)
    .sort((a, b) => a.position - b.position)
    .map((p) => p.surahNumber);
}

function progressOf(rows: DashRows, person: PersonRow, full: boolean, now: Date = new Date()): DashProgress {
  const sessions = rows.sessions.filter((s) => s.userId === person.id);
  const plan = planOf(rows, person.id);
  const reach = deriveReach(plan, forPosition(sessions, person.planChangedAt));
  const position = deriveCurrentPosition(plan, reach);
  const logged = [...new Set(sessions.filter((s) => s.source === "LOGGED").map((s) => day(s.day)))].sort();
  const base: DashProgress = {
    position: position ? { surahNumber: position.surahNumber, ayah: position.ayah } : null,
    firstSurah: plan[0] ?? null,
    loggedDays: full ? logged : logged.slice(-CHILD_DAYS),
  };
  if (!full) return base;
  const g = rows.goals.find((x) => x.userId === person.id);
  const full$: DashProgress = {
    ...base,
    memorizedPages: coveredQuranPages(buildCoverage(sessions)),
    goal: g
      ? {
          plan,
          spec: { target: g.target, juz: g.juz, surah: g.surah, ayah: g.ayah, startDay: day(g.startDay), deadline: day(g.deadline) },
          // only what the goal needs: memorized ranges and their days
          sessions: sessions.filter((s) => s.type === "NEW").map((s) => ({ surahNumber: s.surahNumber, fromAyah: s.fromAyah, toAyah: s.toAyah, type: s.type, day: day(s.day), prior: s.source === "PRIOR" })),
        }
      : null,
    streak: {
      schedule: rows.commitDays
        .filter((c) => c.userId === person.id)
        .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
        .map((c) => ({ from: day(c.effectiveFrom), days: c.days })),
      loggedDays: logged,
      createdAt: person.createdAt.toISOString(),
    },
  };
  const paused = rows.paused?.[person.id];
  return paused ? resultsOf(full$, paused, person.createdAt, now) : full$;
}

/**
 * «أيام العذر»: a woman's 🔥 and goal as results only, for each day that may
 * be the viewer's today (yesterday, today and tomorrow by the server's
 * clock). Paused days count as days off and leave the goal's count, but
 * nothing says so: never «متأخرة» on a paused day, no reason shown.
 */
function resultsOf(p: DashProgress, paused: string[], createdAt: Date, now: Date = new Date()): DashProgress {
  const { goal, streak, ...rest } = p;
  const todays = [-1, 0, 1].map((n) => shiftDay(day(now), n));
  const upTo = (d: string) => new Set(paused.filter((x) => x <= d));
  const goalBy: Record<string, GoalView | null> = {};
  const streakBy: Record<string, { current: number; best: number }> = {};
  for (const d of todays) {
    const v = goal ? computeGoal(goal.plan, goal.spec, goal.sessions, d, upTo(d)) : null;
    goalBy[d] = v?.state === "ACTIVE" ? { ...v, paused: false } : v;
    if (streak) streakBy[d] = computeStreak(streak.schedule, new Set(streak.loggedDays), d, commitStart(streak.loggedDays, day(createdAt)), upTo(d));
  }
  return { ...rest, goalBy, streakBy };
}

// a sibling's ticks: today only — the server doesn't know the viewer's day, so
// the last 2 days go (today, and a day of time-zone slack)
const SIBLING_DAYS = 2;
const shiftDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * One item as anonymous rows: itself, or — «أيام العذر», days it wasn't
 * counted — the stretches between those days, each a row of its own (as an
 * item removed and added again), so the scores leave them out without a
 * sign of why. A stretch starts or ends at noon UTC of its day, which every
 * viewer's browser reads as that day.
 */
function pieces(i: DashRows["trackerItems"][number], skippedDays: string[]): { from: string; until: string | null; createdAt: string; archivedAt: string | null }[] {
  const first = { from: day(i.createdAt), createdAt: i.createdAt.toISOString() };
  const last = { until: i.archivedAt ? day(i.archivedAt) : null, archivedAt: i.archivedAt ? i.archivedAt.toISOString() : null };
  const out: ReturnType<typeof pieces> = [];
  let start = first;
  // only days within its life matter
  const within = skippedDays.filter((d) => d >= first.from && (last.until === null || d < last.until));
  for (const d of [...new Set(within)].sort()) {
    if (d > start.from) out.push({ ...start, until: d, archivedAt: `${d}T12:00:00.000Z` });
    const next = shiftDay(d, 1);
    start = { from: next, createdAt: `${next}T12:00:00.000Z` };
  }
  if (last.until === null || last.until > start.from) out.push({ ...start, ...last });
  return out;
}

/** Today's and the last days' completion only: anonymous items (t0, t1, …) and which of them were ticked on each day. */
function trackerOf(rows: DashRows, userId: string, todayOnly = false, now: Date = new Date()): NonNullable<DashCard["tracker"]> {
  const own = rows.trackerItems.filter((i) => i.userId === userId);
  const skipped = rows.skipped?.[userId];
  if (skipped?.length) return quietTracker(rows, userId, own, skipped, todayOnly, now);
  const alias = new Map(own.map((i, n) => [i.id, `t${n}`]));
  const items: DashItem[] = own.map((i) => ({
    id: alias.get(i.id)!,
    value: i.value,
    status: "APPROVED",
    days: i.days,
    createdDay: day(i.createdAt),
    archivedDay: i.archivedAt ? day(i.archivedAt) : null,
    createdAt: i.createdAt.toISOString(),
    archivedAt: i.archivedAt ? i.archivedAt.toISOString() : null,
  }));
  const checks: Record<string, string[]> = {};
  const since = shiftDay(day(now), -SIBLING_DAYS);
  for (const c of rows.checks) {
    const id = c.userId === userId ? alias.get(c.itemId) : undefined;
    if (id && (!todayOnly || day(c.day) >= since)) (checks[day(c.day)] ??= []).push(id);
  }
  return todayOnly ? { items, checks, todayOnly } : { items, checks };
}

/** trackerOf with «أيام العذر»: the items split around the days they weren't counted (pieces). */
function quietTracker(
  rows: DashRows,
  userId: string,
  own: DashRows["trackerItems"],
  skipped: string[],
  todayOnly: boolean,
  now: Date,
): NonNullable<DashCard["tracker"]> {
  const skippedOf = new Map<string, string[]>();
  for (const key of skipped) {
    const at = key.indexOf(":");
    const id = key.slice(at + 1);
    skippedOf.set(id, [...(skippedOf.get(id) ?? []), key.slice(0, at)]);
  }
  const items: DashItem[] = [];
  // item id → its rows' aliases, each with its stretch
  const rowsOf = new Map<string, { alias: string; from: string; until: string | null }[]>();
  for (const i of own) {
    for (const p of pieces(i, skippedOf.get(i.id) ?? [])) {
      const alias = `t${items.length}`;
      items.push({ id: alias, value: i.value, status: "APPROVED", days: i.days, createdDay: p.from, archivedDay: p.until, createdAt: p.createdAt, archivedAt: p.archivedAt });
      rowsOf.set(i.id, [...(rowsOf.get(i.id) ?? []), { alias, from: p.from, until: p.until }]);
    }
  }
  const checks: Record<string, string[]> = {};
  const since = shiftDay(day(now), -SIBLING_DAYS);
  for (const c of rows.checks) {
    if (c.userId !== userId) continue;
    const d = day(c.day);
    const row = rowsOf.get(c.itemId)?.find((r) => d >= r.from && (r.until === null || d < r.until));
    if (row && (!todayOnly || d >= since)) (checks[d] ??= []).push(row.alias);
  }
  return todayOnly ? { items, checks, todayOnly } : { items, checks };
}

export function buildDashboard(viewer: DashViewer, facts: DashFacts, rows: DashRows, now: Date = new Date()): DashboardData {
  const s = dashboardSections(viewer, facts);
  const children: DashCard[] = facts.children
    .filter((c) => s.childIds.includes(c.id))
    .map((c, n) => ({
      key: viewer.kind === "ADULT" ? c.id : `s${n}`,
      kind: "CHILD",
      name: c.name ?? "",
      gender: c.gender,
      isMe: false,
      href: viewer.kind === "ADULT" ? `/rafiq/family/${facts.familyId}/child/${c.id}` : undefined,
      progress: progressOf(rows, c, false),
      // a sibling sees today's completion only; an adult the last days too
      tracker: trackerOf(rows, c.id, viewer.kind === "CHILD", now),
    }));
  const adults: DashCard[] = facts.adults
    .filter((a) => a.shareProgress || a.shareTracker)
    .map((a, n) => ({
      key: `a${n}`,
      kind: "ADULT",
      name: a.name ?? "",
      gender: a.gender,
      isMe: viewer.kind === "ADULT" && viewer.id === a.id,
      ...(a.shareProgress ? { progress: progressOf(rows, a, true, now) } : {}),
      ...(a.shareTracker ? { tracker: trackerOf(rows, a.id) } : {}),
    }));
  return { children, adults };
}
