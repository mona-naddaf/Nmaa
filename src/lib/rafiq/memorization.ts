import "server-only";
import { prisma } from "@/lib/db";
import { deriveCurrentPosition, deriveReach, type PlanPosition, type Reach } from "@/lib/recitation/logic";
import { buildCoverage, computeProgressBars, coverageToRanges, coveredQuranPages, type ProgressBar } from "@/lib/students/progress";
import { reviewAges, type ReviewAge } from "@/lib/students/review";
import { MISTAKE_SELECT, mergeActiveMistakes, withNextWords } from "@/lib/students/mistakes";
import type { ActiveMistake } from "@/lib/students/mistake-types";
import { goalSpecOf } from "@/lib/goals/data";
import type { GoalSpec } from "@/lib/goals/goal";

// Everything «رفيق الحفظ» shows about her memorization, derived from her own
// sessions with the same logic as a course student's page (position, gap
// detection, coverage, progress bars, review reminders). Every query here is
// scoped by her user id.

// her progress bars are always all on (a course toggles each one)
const ALL_BARS = { showSurahProgress: true, showJuzProgress: true, showQuranProgress: true, showPlanProgress: true };

type SessionRow = {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  type: "NEW" | "REVIEW" | "LINK";
  situation: "CONTINUE" | "NEXT" | "SURAH_GAP" | "AYAH_GAP" | "EDIT" | null;
  reason: string | null;
  createdAt: Date;
};

/**
 * Sessions as position logic should see them. Her plan can change any time
 * (unlike a course); a gap she approved under an earlier plan would point
 * somewhere else in the new order, so approvals recorded before the latest
 * change stop counting. The ayat themselves always stay memorized.
 */
export function forPosition<T extends SessionRow>(sessions: T[], planChangedAt: Date | null): T[] {
  if (!planChangedAt) return sessions;
  return sessions.map((s) => (s.createdAt < planChangedAt ? { ...s, situation: null } : s));
}

export async function getPlan(userId: string) {
  const user = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: userId },
    select: { planTemplate: true, planChangedAt: true, reviewReminderDays: true, planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } } },
  });
  return { ...user, plan: user.planItems.map((p) => p.surahNumber) };
}

/** Her position and reach, for gap checks when she saves a session. */
export async function getReach(userId: string, plan: number[], planChangedAt: Date | null): Promise<Reach> {
  const sessions = await prisma.rafiqSession.findMany({
    where: { userId },
    select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, situation: true, reason: true, createdAt: true },
  });
  return deriveReach(plan, forPosition(sessions, planChangedAt));
}

export interface HistoryEntry {
  id: string;
  day: string;
  source: "LOGGED" | "PRIOR";
  type: "NEW" | "REVIEW" | "LINK";
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  pages: number;
  quality: "EXCELLENT" | "GOOD" | "NEEDS_REPEAT" | null;
  reason: string | null;
  notes: string | null;
  mistakes: number;
  // «العائلة»: an adult recorded it on a child's page (recordedById: who;
  // null once her account is gone), and whether an adult set its assessment
  recordedByAdult: boolean;
  recordedById: string | null;
  qualityByAdult: boolean;
}

export interface MemorizationView {
  plan: number[];
  position: PlanPosition | null;
  reach: Reach;
  memorizedRanges: Record<number, [number, number][]>;
  memorizedPages: number;
  recitedPages: number;
  loggedSessions: number;
  progressBars: ProgressBar[];
  mistakes: ActiveMistake[];
  reviewReminderDays: number | null;
  // each completed surah's review clock, on the days she logged her
  // sessions; her browser picks the overdue ones with her own today
  // (overdueFrom), as the server can't know her day
  reviewAges: ReviewAge[];
  history: HistoryEntry[];
  // her memorization goal, worked out in her browser with her own day
  // (lib/goals/goal.ts, from `history`); null without one
  goal: GoalSpec | null;
}

/** Her goal as stored (null without one). */
export async function getGoal(userId: string): Promise<GoalSpec | null> {
  const row = await prisma.rafiqGoal.findUnique({ where: { userId } });
  return row ? goalSpecOf(row) : null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const day = (d: Date) => d.toISOString().slice(0, 10);

/** null when she hasn't set up a plan yet. */
export async function getMemorization(userId: string): Promise<MemorizationView | null> {
  const { planTemplate, planChangedAt, reviewReminderDays, plan } = await getPlan(userId);
  if (!planTemplate) return null;

  const [sessions, mistakeRows, homeMarkRows, goal] = await Promise.all([
    prisma.rafiqSession.findMany({
      where: { userId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      include: { _count: { select: { mistakes: true } } },
    }),
    prisma.rafiqMistake.findMany({
      where: { userId, resolvedAt: null },
      select: { ...MISTAKE_SELECT, flaggedAt: true },
      orderBy: [{ flaggedAt: "asc" }, { createdAt: "asc" }],
    }),
    // her self-marked words from home practice join the same list, labelled
    prisma.rafiqHomeMistake.findMany({
      where: { userId, resolvedAt: null },
      select: { ...MISTAKE_SELECT, flaggedAt: true },
    }),
    getGoal(userId),
  ]);
  // oldest first across both sources, so each word keeps its latest type
  const allMarks = [
    ...mistakeRows.map((r) => ({ ...r, source: "SESSION" as const })),
    ...homeMarkRows.map((r) => ({ ...r, source: "HOME" as const })),
  ].sort((a, b) => a.flaggedAt.getTime() - b.flaggedAt.getTime());

  const reach = deriveReach(plan, forPosition(sessions, planChangedAt));
  const position = deriveCurrentPosition(plan, reach);
  const coverage = buildCoverage(sessions);

  return {
    plan,
    position,
    reach,
    memorizedRanges: coverageToRanges(coverage),
    memorizedPages: coveredQuranPages(coverage),
    recitedPages: round3(sessions.filter((s) => s.source === "LOGGED").reduce((sum, s) => sum + Number(s.pagesCalculated), 0)),
    loggedSessions: sessions.filter((s) => s.source === "LOGGED").length,
    progressBars: computeProgressBars({ settings: ALL_BARS, plan, position, coverage }),
    // first-flag times go out whole: her browser shows them as her own day
    mistakes: withNextWords(mergeActiveMistakes(allMarks, plan, (d) => d.toISOString())),
    reviewReminderDays,
    reviewAges: reviewReminderDays ? reviewAges(sessions, (s) => day(s.day)) : [],
    history: sessions.map((s) => ({
      id: s.id,
      day: day(s.day),
      source: s.source,
      type: s.type,
      surahNumber: s.surahNumber,
      fromAyah: s.fromAyah,
      toAyah: s.toAyah,
      pages: Number(s.pagesCalculated),
      quality: s.quality,
      reason: s.reason,
      notes: s.notes,
      mistakes: s._count.mistakes,
      recordedByAdult: s.recordedByAdult,
      recordedById: s.recordedById,
      qualityByAdult: s.qualityByAdult,
    })),
    goal,
  };
}
