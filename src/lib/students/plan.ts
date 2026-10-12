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

// A course student's plan as every screen and check should see it — the one
// place the stored plan becomes the order position, gaps and pre-fills
// follow. For an untouched «ترتيب المصحف بالعكس» that is the reverse order
// with each juz in its direction; any other plan is used as stored.

/** Spread into a Student `include` to load what studentPlan needs (scalars come with include). */
export const PLAN_INCLUDE = {
  planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
  juzDirections: { select: { juz: true, direction: true, source: true } },
} as const satisfies Prisma.StudentInclude;

/** The same, for a Student `select`. */
export const PLAN_FIELDS = { planTemplate: true, planChangedAt: true, ...PLAN_INCLUDE } as const satisfies Prisma.StudentSelect;

export interface StudentPlanRow {
  planTemplate: PlanTemplate;
  planChangedAt: Date | null;
  planItems: { surahNumber: number }[];
  juzDirections: { juz: number; direction: JuzDirection }[];
}

export interface StudentPlan {
  plan: number[];
  // null when the plan has no directions (not an untouched reverse plan)
  directions: JuzDirections | null;
  planChangedAt: Date | null;
}

export function studentPlan(row: StudentPlanRow): StudentPlan {
  const stored = row.planItems.map((p) => p.surahNumber);
  if (!isStockReverse(row.planTemplate, stored)) return { plan: stored, directions: null, planChangedAt: row.planChangedAt };
  const directions: JuzDirections = Object.fromEntries(row.juzDirections.map((d) => [d.juz, d.direction]));
  return { plan: reverseOrder(directions), directions, planChangedAt: row.planChangedAt };
}

/**
 * Sessions as position logic should see them. A gap approved under an
 * earlier plan would point somewhere else in the new order, so approvals
 * saved before the latest manual plan change stop counting (as in «رفيق
 * الحفظ»). The ayat themselves always stay memorized. A juz direction
 * correction is not a plan change: approvals are simply re-read in the
 * corrected order.
 */
export function forPlanPosition<T extends { situation: string | null; createdAt: Date }>(sessions: T[], planChangedAt: Date | null): T[] {
  if (!planChangedAt) return sessions;
  return sessions.map((s) => (s.createdAt < planChangedAt ? { ...s, situation: null } : s));
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
    where: { studentId },
    select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, source: true, occurredAt: true },
  });
  const decided = new Set(student.juzDirections.map((d) => d.juz));
  const data = inferJuzDirections(sessions).flatMap((j) =>
    j.direction && !decided.has(j.juz) ? [{ studentId, juz: j.juz, direction: j.direction, source: "AUTO" as const }] : [],
  );
  if (data.length > 0) await db.studentJuzDirection.createMany({ data, skipDuplicates: true });
}
