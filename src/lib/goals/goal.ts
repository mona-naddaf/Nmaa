import { AYAH_COUNT, SURAH_NAME, getAyahPageEntries } from "@/lib/quran-data";
import { juzSegments } from "@/lib/quran-data/juz";
import { daysBetween } from "@/lib/calendar/hijri";
import { advancesPosition, type SessionType } from "@/lib/recitation/logic";
import { DAYS_AFTER_PREP, countLabel, type CountForms } from "@/lib/text/count";

// An optional memorization goal with a deadline, for a course student and
// for «رفيق الحفظ» alike: how much is left, how much per day, and whether
// she is on schedule. Pure, so the server (courses, the course's day) and the
// browser («رفيق الحفظ», her own day) compute it the same way.
//
// The target is a stretch of her CURRENT plan, in its walking order (juz
// directions included): from the plan's start up to an end point — the
// plan's end, the last ayah of juz N in that order, or a chosen ayah. It is
// recomputed from the plan every time, so a plan change or a direction
// correction moves it too.
//
// What counts is coverage: any ayah of the stretch recited as new
// memorization, however it got there (prior memorization, a combined
// recitation, her second track). Ayat skipped by an approved gap aren't
// memorized, so they are still left to do.
//
// Days are whole calendar days ("YYYY-MM-DD"), every day counting. What was
// memorized before the goal's start day — and prior memorization, whenever
// it was entered — is her starting point. The daily target is what was left
// at the start of today spread over the days left (today and the deadline
// included), so it doesn't shrink while she recites today; it rises when
// she falls behind and drops when she gets ahead.

export type GoalTargetKind = "PLAN" | "JUZ" | "POINT";

export interface GoalTarget {
  target: GoalTargetKind;
  juz: number | null;
  surah: number | null;
  ayah: number | null;
}

export interface GoalSpec extends GoalTarget {
  startDay: string;
  deadline: string;
}

export interface GoalSession {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  type: SessionType;
  // the day it counts for ("YYYY-MM-DD")
  day: string;
  // prior memorization: always part of her starting point
  prior: boolean;
}

interface Segment {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
}

/** The last ayah of the target in plan order, or null when it isn't in this plan. */
export function targetEnd(plan: number[], t: GoalTarget): { index: number; ayah: number } | null {
  if (plan.length === 0) return null;
  if (t.target === "PLAN") {
    const last = plan[plan.length - 1];
    return { index: plan.length - 1, ayah: AYAH_COUNT[last] };
  }
  if (t.target === "POINT") {
    const index = t.surah === null ? -1 : plan.indexOf(t.surah);
    const count = t.surah === null ? 0 : (AYAH_COUNT[t.surah] ?? 0);
    if (index === -1 || t.ayah === null || t.ayah < 1 || t.ayah > count) return null;
    return { index, ayah: t.ayah };
  }
  // JUZ: the surah of juz N that comes last in her plan, to the end of its part in the juz
  const segs = t.juz === null ? [] : juzSegments(t.juz);
  let best: { index: number; ayah: number } | null = null;
  for (const seg of segs) {
    const index = plan.indexOf(seg.surahNumber);
    if (index !== -1 && (!best || index > best.index)) best = { index, ayah: seg.toAyah };
  }
  return best;
}

/** The stretch of the plan the goal covers, in plan order; null when the target isn't in this plan. */
export function targetStretch(plan: number[], t: GoalTarget): Segment[] | null {
  const end = targetEnd(plan, t);
  if (!end) return null;
  return plan.slice(0, end.index + 1).map((surahNumber, i) => ({
    surahNumber,
    fromAyah: 1,
    toAyah: i === end.index ? end.ayah : AYAH_COUNT[surahNumber],
  }));
}

/** «إكمال الخطة» / «حتى نهاية الجزء 29» / «حتى نهاية سورة الملك» / «حتى سورة الملك — الآية 20» */
export function targetLabel(t: GoalTarget): string {
  if (t.target === "PLAN") return "إكمال الخطة";
  if (t.target === "JUZ") return `حتى نهاية الجزء ${t.juz}`;
  const name = SURAH_NAME[t.surah!] ?? "";
  return t.ayah === AYAH_COUNT[t.surah!] ? `حتى نهاية سورة ${name}` : `حتى سورة ${name} — الآية ${t.ayah}`;
}

type Covered = Map<number, Set<number>>;

function coveredBy(sessions: GoalSession[], counts: (s: GoalSession) => boolean): Covered {
  const covered: Covered = new Map();
  for (const s of sessions) {
    if (!advancesPosition(s) || !counts(s)) continue;
    const count = AYAH_COUNT[s.surahNumber];
    if (!count) continue;
    const ayat = covered.get(s.surahNumber) ?? new Set<number>();
    for (let a = Math.max(1, s.fromAyah); a <= Math.min(count, s.toAyah); a++) ayat.add(a);
    covered.set(s.surahNumber, ayat);
  }
  return covered;
}

/** The stretch's ayat not yet covered: their total pages, and each one's page fraction in plan order. */
function uncovered(stretch: Segment[], covered: Covered): { pages: number; fracs: number[] } {
  let pages = 0;
  const fracs: number[] = [];
  for (const seg of stretch) {
    const entries = getAyahPageEntries(seg.surahNumber);
    const have = covered.get(seg.surahNumber);
    for (let a = seg.fromAyah; a <= seg.toAyah; a++) {
      if (have?.has(a)) continue;
      pages += entries?.[a - 1]?.[0] ?? 0;
      fracs.push(entries?.[a - 1]?.[0] ?? 0);
    }
  }
  return { pages, fracs };
}

export type GoalStatus = "ON_TRACK" | "BEHIND" | "AHEAD";

export type GoalView = { label: string; deadline: string } & (
  | // the end point isn't in her current plan (staff / she should edit it)
  { state: "INVALID" }
  | { state: "REACHED" }
  | { state: "EXPIRED"; remainingPages: number }
  | {
      state: "ACTIVE";
      // pages per day, rounded to a quarter (at least a quarter)
      dailyQuarter: number;
      // about how many of her next ayat that is
      dailyAyat: number;
      // pages memorized today (toward the goal)
      doneToday: number;
      // today's exact share is done
      todayDone: boolean;
      remainingPages: number;
      // today and the deadline included
      daysLeft: number;
      status: GoalStatus;
    }
);

const EPS = 1e-6;

export function computeGoal(plan: number[], spec: GoalSpec, sessions: GoalSession[], today: string): GoalView {
  const base = { label: targetLabel(spec), deadline: spec.deadline };
  const stretch = targetStretch(plan, spec);
  if (!stretch) return { ...base, state: "INVALID" };

  const now = uncovered(stretch, coveredBy(sessions, () => true));
  if (now.fracs.length === 0) return { ...base, state: "REACHED" };
  if (today > spec.deadline) return { ...base, state: "EXPIRED", remainingPages: now.pages };

  const atStart = uncovered(stretch, coveredBy(sessions, (s) => s.prior || s.day < spec.startDay));
  const startOfToday = uncovered(stretch, coveredBy(sessions, (s) => s.prior || s.day < today));

  const daysLeft = daysBetween(today, spec.deadline) + 1;
  const dailyExact = startOfToday.pages / daysLeft;
  const dailyQuarter = Math.max(0.25, Math.round(dailyExact * 4) / 4);
  // her next ayat (not yet memorized this morning) until a day's share is filled
  let dailyAyat = 0;
  let acc = 0;
  for (const p of startOfToday.fracs) {
    if (acc >= dailyQuarter - EPS) break;
    acc += p;
    dailyAyat++;
  }

  // the straight line from the start day to the deadline: where she should
  // be by the end of yesterday, against what she has done since the start
  const totalDays = Math.max(1, daysBetween(spec.startDay, spec.deadline) + 1);
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(spec.startDay, today)));
  const pace = atStart.pages / totalDays;
  const diff = atStart.pages - now.pages - (atStart.pages * elapsed) / totalDays;
  const status: GoalStatus = diff > pace + EPS ? "AHEAD" : diff < -pace - EPS ? "BEHIND" : "ON_TRACK";

  const doneToday = Math.max(0, startOfToday.pages - now.pages);
  return {
    ...base,
    state: "ACTIVE",
    dailyQuarter,
    dailyAyat,
    doneToday,
    todayDone: doneToday >= dailyExact - EPS,
    remainingPages: now.pages,
    daysLeft,
    status,
  };
}

// ---------- wording ----------

const PAGES: CountForms = { one: "صفحة واحدة", two: "صفحتان", few: "صفحات", many: "صفحة" };
const AYAT: CountForms = { one: "آية واحدة", two: "آيتان", few: "آيات", many: "آية" };

const QUARTER_WORDS: Record<number, string> = {
  0.25: "ربع صفحة",
  0.5: "نصف صفحة",
  0.75: "ثلاثة أرباع صفحة",
  1.25: "صفحة وربع",
  1.5: "صفحة ونصف",
  1.75: "صفحة وثلاثة أرباع",
};

/** A quarter-rounded page amount: «نصف صفحة», «صفحة ونصف», «صفحتان», «3 صفحات», «2.25 صفحة». */
export function quarterPagesLabel(q: number): string {
  if (QUARTER_WORDS[q]) return QUARTER_WORDS[q];
  return Number.isInteger(q) ? countLabel(q, PAGES) : `${q} صفحة`;
}

export const ayatLabel = (n: number) => countLabel(n, AYAT);

/** «12.4 صفحة» (as the site writes page totals) */
export const pagesTotalLabel = (n: number) => `${Math.round(n * 10) / 10} صفحة`;

/** «خلال 40 يومًا», «اليوم آخر يوم» */
export function daysLeftLabel(days: number): string {
  return days === 1 ? "اليوم آخر يوم" : `خلال ${countLabel(days, DAYS_AFTER_PREP)}`;
}
