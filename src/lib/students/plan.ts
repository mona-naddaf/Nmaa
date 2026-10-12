import "server-only";
import type { PlanTemplate, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  inferJuzDirections,
  isStockReverse,
  reverseOrder,
  type InferenceSession,
  type JuzAdoption,
  type JuzDirection,
  type JuzDirections,
} from "@/lib/recitation/juz-direction";
import { TRACK_KIND_LABEL, trackContext, trackPositionText, trackProgress, type SecondTrack, type TrackKind, type TrackProgress } from "@/lib/recitation/tracks";
import { SURAH_NAME } from "@/lib/quran-data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { entryContext } from "@/lib/recitation/combined";
import type { PositionSession } from "@/lib/recitation/logic";

// A course student's plan as every screen and check should see it — the one
// place the stored plan becomes the order position, gaps and pre-fills
// follow. For an untouched «ترتيب المصحف بالعكس» that is the reverse order
// with each juz in its direction; any other plan is used as stored.

/** Spread into a Student `include` to load what studentPlan needs (scalars come with include). */
export const PLAN_INCLUDE = {
  planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
  juzDirections: { select: { juz: true, direction: true, source: true } },
  // her active second track, if any (lib/recitation/tracks.ts)
  secondTracks: { where: { endedAt: null }, select: { id: true, kind: true, startSurah: true, startAyah: true } },
} as const satisfies Prisma.StudentInclude;

/** The same, for a Student `select`. */
export const PLAN_FIELDS = { planTemplate: true, planChangedAt: true, ...PLAN_INCLUDE } as const satisfies Prisma.StudentSelect;

export interface StudentPlanRow {
  planTemplate: PlanTemplate;
  planChangedAt: Date | null;
  planItems: { surahNumber: number }[];
  juzDirections: { juz: number; direction: JuzDirection }[];
  secondTracks?: SecondTrack[];
}

export interface StudentPlan {
  plan: number[];
  // null when the plan has no directions (not an untouched reverse plan)
  directions: JuzDirections | null;
  planChangedAt: Date | null;
  // her active second track, or null
  second: SecondTrack | null;
}

export function studentPlan(row: StudentPlanRow): StudentPlan {
  const stored = row.planItems.map((p) => p.surahNumber);
  const second = row.secondTracks?.[0] ?? null;
  if (!isStockReverse(row.planTemplate, stored)) return { plan: stored, directions: null, planChangedAt: row.planChangedAt, second };
  const directions: JuzDirections = Object.fromEntries(row.juzDirections.map((d) => [d.juz, d.direction]));
  return { plan: reverseOrder(directions), directions, planChangedAt: row.planChangedAt, second };
}

/**
 * Sessions as her MAIN plan's position logic sees them. A gap approved
 * under an earlier plan would point somewhere else in the new order, so
 * approvals saved before the latest manual plan change stop counting (as in
 * «رفيق الحفظ»); and a gap approved in her second track belongs to that
 * track's order, never to the plan. The ayat themselves always stay
 * memorized. A juz direction correction is not a plan change: approvals
 * are simply re-read in the corrected order.
 */
export function forPlanPosition<T extends { situation?: string | null; createdAt: Date; trackId: string | null }>(
  sessions: T[],
  planChangedAt: Date | null,
): T[] {
  return sessions.map((s) => (s.trackId || (planChangedAt && s.createdAt < planChangedAt) ? { ...s, situation: null } : s));
}

/**
 * Where her main plan and her second track (if any) stand, from all her
 * sessions: `main` / `second` are the contexts a new entry is judged in
 * (lib/recitation/combined.ts); `second` is null without a track or for a
 * «حر» one.
 */
export function trackContexts<T extends PositionSession & { createdAt: Date; trackId: string | null }>(sp: StudentPlan, sessions: T[]) {
  const mainSessions = forPlanPosition(sessions, sp.planChangedAt);
  return {
    mainSessions,
    main: entryContext(sp.plan, sp.directions, mainSessions),
    second: sp.second ? trackContext(sp.second, sessions) : null,
  };
}

export interface SecondTrackView {
  kind: TrackKind;
  // «بترتيب المصحف — من البقرة 1» / «حر (سور متفرقة)»
  title: string;
  // «البقرة — الآية 20 من 286», «لم تبدأ بعد — …», «أتمّ المسار», «يُحسب كل ما يُحفظ فيه»
  positionText: string;
  done: boolean;
  progress: TrackProgress | null;
}

/** Her active second track as the pages show it (null without one). */
export function secondTrackView(
  sp: StudentPlan,
  sessions: (PositionSession & { trackId: string | null })[],
  g: GroupGender,
  // «لم تبدأ بعد» as the page words it (the student portal speaks to her)
  notYet = pickByGroup(g, { m: "لم يبدأ بعد", f: "لم تبدأ بعد" }),
): SecondTrackView | null {
  const t = sp.second;
  if (!t) return null;
  const ctx = trackContext(t, sessions);
  const progress = ctx ? trackProgress(t, ctx) : null;
  return {
    kind: t.kind,
    title: t.kind === "FREE" ? TRACK_KIND_LABEL.FREE : `${TRACK_KIND_LABEL[t.kind]} — من ${SURAH_NAME[t.startSurah!]} ${t.startAyah}`,
    positionText: trackPositionText(t, progress, notYet),
    done: progress?.done ?? false,
    progress,
  };
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Records a direction an entry revealed. Never replaces an existing row: a
 * direction once decided — by an entry, the backfill or by hand — stays.
 */
export function adoptJuzDirection(db: Db, studentId: string, adopt: JuzAdoption) {
  return db.studentJuzDirection.createMany({
    data: [{ studentId, juz: adopt.juz, direction: adopt.direction, source: "AUTO" }],
    skipDuplicates: true,
  });
}

/**
 * After prior memorization is added (at creation or later): decides the
 * still-undecided juz that her memorization now clearly shows. Only for an
 * untouched reverse plan; never replaces a row.
 */
export async function inferDirectionsFromHistory(db: Db, studentId: string): Promise<void> {
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: PLAN_FIELDS });
  if (!studentPlan(student).directions) return;
  const sessions: InferenceSession[] = await db.recitationSession.findMany({
    // her plan's own memorization: a second track's entries decide no juz
    where: { studentId, trackId: null },
    select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, source: true, occurredAt: true },
  });
  const decided = new Set(student.juzDirections.map((d) => d.juz));
  const data = inferJuzDirections(sessions).flatMap((j) =>
    j.direction && !decided.has(j.juz) ? [{ studentId, juz: j.juz, direction: j.direction, source: "AUTO" as const }] : [],
  );
  if (data.length > 0) await db.studentJuzDirection.createMany({ data, skipDuplicates: true });
}
