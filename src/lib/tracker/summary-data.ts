import "server-only";
import { prisma } from "@/lib/db";
import { courseTimeZone } from "@/lib/time/course-zone";
import { addDaysISO, dateOnly, isoOf, safeTimeZone, zoneDayOf, zoneDayRange, zoneToday } from "@/lib/time/zone";
import { excuseLens, type ExcuseLens } from "@/lib/excuse/lens";
import { loadExcuses, loadPauses, nowIn, pausedNow } from "@/lib/excuse/rafiq-data";
import { keyOf, pausedDays } from "@/lib/excuse/rules";
import { itemsForStudentWhere } from "./data";
import { comparisonLabel, computeSummary, periodLabel, periodRange, type PeriodKind, type Summary, type SummaryItem } from "./summary";
import { entryCount } from "@/lib/recitation/combined";
import { getStudentGoal } from "@/lib/goals/data";
import { computeGoal, type GoalView } from "@/lib/goals/goal";
import { getGoal, getPlan } from "@/lib/rafiq/memorization";
import { PLAN_FIELDS, studentPlan } from "@/lib/students/plan";
import { computeStreaks } from "@/lib/students/streak-data";

// Loading «المحصّلات» (summary.ts): for one period and the one before it, a
// fixed handful of queries over the student's (or Rafiq user's) day range —
// items, ticks in the range, recitations in the range — never one per day or
// per item.

export interface SummaryPayload {
  kind: PeriodKind;
  offset: number;
  label: string;
  today: string;
  // the items and ticks of the period, so the page can show a day's details
  items: SummaryItem[];
  checks: Record<string, string[]>;
  summary: Summary;
  previousOverall: number | null;
  comparison: string | null;
  achievements: {
    // pages memorized (new memorization) and recitation sessions in the period
    pages: number;
    sessions: number;
    goal: GoalView | null;
    // a course's weekly 🔥 streak (null when the course has streaks off, or for «رفيق الحفظ»)
    weeklyStreak: number | null;
  };
  // «أيام العذر», only for a viewer who may see the excuse: the period's
  // excuse days, and its «day:itemId» pairs not counted / shown by their
  // alternative (title). Everyone else gets the scores without it.
  excuse?: { days: string[]; skip: string[]; alt: Record<string, string> };
}

const later = (a: string, b: string) => (a > b ? a : b);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function split(checks: { itemId: string; day: Date }[], from: string, to: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of checks) {
    const d = isoOf(c.day);
    if (d >= from && d <= to) (out[d] ??= []).push(c.itemId);
  }
  return out;
}

/** The period's excuse days and changed items, up to `to` (today at the latest). */
function excuseOfPeriod(lens: ExcuseLens, items: SummaryItem[], from: string, to: string): NonNullable<SummaryPayload["excuse"]> {
  const out: NonNullable<SummaryPayload["excuse"]> = { days: [], skip: [], alt: {} };
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    if (!lens.isExcuseDay(d)) continue;
    out.days.push(d);
    for (const i of items) {
      const v = lens.view(i.id, d);
      if (v.state === "SKIP") out.skip.push(keyOf(d, i.id));
      else if (v.state === "ALT" && v.alt) out.alt[keyOf(d, i.id)] = v.alt;
    }
  }
  return out;
}

function assemble(
  kind: PeriodKind,
  offset: number,
  today: string,
  items: SummaryItem[],
  allChecks: { itemId: string; day: Date }[],
  achievements: SummaryPayload["achievements"],
  // «أيام العذر»: what it does to the scores; show: the viewer may see it
  lens?: { lens: ExcuseLens; show: boolean },
): SummaryPayload {
  const cur = periodRange(kind, today, offset);
  const prev = periodRange(kind, today, offset - 1);
  const checks = split(allChecks, cur.from, cur.to);
  const skipped = lens?.lens.skipped;
  const summary = computeSummary({ items, checks, from: cur.from, to: cur.to, today, skipped });
  const previous = computeSummary({ items, checks: split(allChecks, prev.from, prev.to), from: prev.from, to: prev.to, today, skipped });
  const shown = items.filter((i) => summary.items.some((x) => x.id === i.id));
  return {
    ...(lens?.show ? { excuse: excuseOfPeriod(lens.lens, shown, cur.from, cur.to < today ? cur.to : today) } : {}),
    kind,
    offset,
    label: periodLabel(kind, cur.from, cur.to),
    today,
    // only what this period's page needs
    items: shown,
    checks,
    summary,
    previousOverall: previous.overall,
    comparison: comparisonLabel(kind, summary.overall, previous.overall),
    achievements,
  };
}

/** A course student's summary for a period (offset 0 = the current one, −1 the one before, …). */
export async function courseSummary(studentId: string, kind: PeriodKind, offset: number): Promise<SummaryPayload> {
  const s = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { id: true, courseId: true, groupId: true, createdAt: true, course: { select: { streakMode: true } }, ...PLAN_FIELDS },
  });
  const tz = await courseTimeZone(s.courseId);
  const today = zoneToday(tz);
  const cur = periodRange(kind, today, offset);
  const prev = periodRange(kind, today, offset - 1);
  const window = zoneDayRange(tz, prev.from, cur.to);
  const joined = zoneDayOf(tz, s.createdAt);

  const [rows, checks, inPeriod, allSessions] = await Promise.all([
    // approved items reaching her that lived during the two periods
    prisma.trackerItem.findMany({
      where: {
        AND: [
          itemsForStudentWhere(s),
          { status: "APPROVED", value: { not: null }, createdAt: { lt: window.lt } },
          { OR: [{ archivedAt: null }, { archivedAt: { gte: window.gte } }] },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, title: true, value: true, days: true, createdAt: true, reviewedAt: true, archivedAt: true, createdByStudentId: true },
    }),
    prisma.trackerCheck.findMany({
      where: { studentId, day: { gte: dateOnly(prev.from), lte: dateOnly(cur.to) } },
      select: { itemId: true, day: true },
    }),
    prisma.recitationSession.findMany({
      where: { studentId, source: "LOGGED", occurredAt: zoneDayRange(tz, cur.from, cur.to) },
      select: { type: true, pagesCalculated: true, comboId: true },
    }),
    prisma.recitationSession.findMany({
      where: { studentId },
      select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, source: true, occurredAt: true },
    }),
  ]);

  const items: SummaryItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    value: r.value!,
    days: r.days,
    // due from the day it existed, was approved (her own items: when staff approved them), and she was in the course
    fromDay: [zoneDayOf(tz, r.createdAt), r.createdByStudentId && r.reviewedAt ? zoneDayOf(tz, r.reviewedAt) : "", joined].reduce(later),
    untilDay: r.archivedAt ? zoneDayOf(tz, r.archivedAt) : null,
  }));

  const sp = studentPlan(s);
  const goal = (await getStudentGoal(studentId, sp.plan, allSessions, tz))?.view ?? null;
  let weeklyStreak: number | null = null;
  if (s.course.streakMode) {
    const group = await prisma.student.findMany({ where: { groupId: s.groupId, archivedAt: null }, select: { id: true, groupId: true } });
    weeklyStreak = (await computeStreaks(s.course.streakMode, group, tz)).get(s.id) ?? 0;
  }

  return assemble(kind, offset, today, items, checks, {
    pages: round3(inPeriod.filter((x) => x.type === "NEW").reduce((n, x) => n + Number(x.pagesCalculated), 0)),
    sessions: entryCount(inPeriod),
    goal,
    weeklyStreak,
  });
}

/**
 * A «رفيق الحفظ» user's summary, on her own days: browserZone is her
 * browser's time zone (her days; anything unknown → Riyadh's). excuse:
 * «أيام العذر» counts in her scores (ownExcuse().show), and whether this
 * viewer may also see it.
 */
export async function rafiqSummary(
  userId: string,
  kind: PeriodKind,
  offset: number,
  browserZone: unknown,
  excuse: { count: boolean; show: boolean } = { count: false, show: false },
): Promise<SummaryPayload> {
  const tz = safeTimeZone(typeof browserZone === "string" ? browserZone : null);
  const today = zoneToday(tz);
  const cur = periodRange(kind, today, offset);
  const prev = periodRange(kind, today, offset - 1);
  const window = zoneDayRange(tz, prev.from, cur.to);

  const [rows, checks, sessions, { plan }, goalSpec] = await Promise.all([
    prisma.rafiqTrackerItem.findMany({
      where: { userId, createdAt: { lt: window.lt }, OR: [{ archivedAt: null }, { archivedAt: { gte: window.gte } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, title: true, value: true, days: true, createdAt: true, archivedAt: true, excuseMode: true, excuseAltTitle: true },
    }),
    prisma.rafiqTrackerCheck.findMany({
      where: { userId, day: { gte: dateOnly(prev.from), lte: dateOnly(cur.to) } },
      select: { itemId: true, day: true },
    }),
    prisma.rafiqSession.findMany({
      where: { userId },
      select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, source: true, day: true, pagesCalculated: true },
    }),
    getPlan(userId),
    getGoal(userId),
  ]);

  const items: SummaryItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    value: r.value,
    days: r.days,
    fromDay: zoneDayOf(tz, r.createdAt),
    untilDay: r.archivedAt ? zoneDayOf(tz, r.archivedAt) : null,
  }));
  const inPeriod = sessions.filter((x) => x.source === "LOGGED" && isoOf(x.day) >= cur.from && isoOf(x.day) <= cur.to);
  // «أيام العذر»: her paused days leave the goal's count; a viewer who may
  // not see them gets the result only, never that today is paused
  const paused = excuse.count && goalSpec ? pausedDays(await loadPauses(userId), today) : undefined;
  const computed = goalSpec
    ? computeGoal(
        plan,
        goalSpec,
        sessions.map((x) => ({ surahNumber: x.surahNumber, fromAyah: x.fromAyah, toAyah: x.toAyah, type: x.type, day: isoOf(x.day), prior: x.source === "PRIOR" })),
        today,
        paused,
      )
    : null;
  // «paused» (D6) means paused right now: after she resumes, today still counts as paused, but the goal shows its daily amount
  const goal = computed?.state === "ACTIVE" && computed.paused && !(excuse.show && (await pausedNow(userId))) ? { ...computed, paused: false } : computed;

  return assemble(kind, offset, today, items, checks, {
    pages: round3(inPeriod.filter((x) => x.type === "NEW").reduce((n, x) => n + Number(x.pagesCalculated), 0)),
    sessions: inPeriod.length,
    goal,
    weeklyStreak: null,
  }, excuse.count ? { lens: excuseLens(rows, await loadExcuses(userId, prev.from), nowIn(tz)), show: excuse.show } : undefined);
}
