import "server-only";
import { prisma } from "@/lib/db";
import { studentTimeZone } from "@/lib/time/course-zone";
import { addDaysISO, zoneDayOf, zoneToday } from "@/lib/time/zone";
import { summarize, SUMMARY_RECENT_DAYS, type TajweedSummary } from "./summary";

// «ملخّص أخطاء التجويد» for a course student: built ONLY from the mistakes
// her teachers recorded (RecitationMistake). Her own home marks
// (HomeMistake) are private to her and are never read here. «تم الإتقان»
// removes a mistake for good, so mastered ones are never counted.

/**
 * Whether the block may show for her: the course has detailed tajweed on
 * and she is held to it. Callers check this before loading the summary.
 */
export async function tajweedSummaryOn(studentId: string): Promise<boolean> {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { tajweedDetailed: true, course: { select: { tajweedDetailEnabled: true } } },
  });
  return !!s && s.tajweedDetailed && s.course.tajweedDetailEnabled;
}

/**
 * Her open detailed mistakes, counted for the last 30 days (the course's
 * days, today included) and for the whole period. null when she has none at
 * all (the block is then not shown).
 */
export async function getTajweedSummary(studentId: string): Promise<TajweedSummary | null> {
  const rows = await prisma.recitationMistake.findMany({
    where: { studentId, resolvedAt: null, tajweedKind: { not: "NONE" } },
    select: { tajweedKind: true, tajweedCode: true, letterText: true, flaggedAt: true },
  });
  if (rows.length === 0) return null;
  const timeZone = await studentTimeZone(studentId);
  const since = addDaysISO(zoneToday(timeZone), -(SUMMARY_RECENT_DAYS - 1));
  const toRow = (r: (typeof rows)[number]) => ({ kind: r.tajweedKind as Exclude<typeof r.tajweedKind, "NONE">, code: r.tajweedCode, letterText: r.letterText });
  return {
    recent: summarize(rows.filter((r) => zoneDayOf(timeZone, r.flaggedAt) >= since).map(toRow)),
    all: summarize(rows.map(toRow)),
  };
}

/** The block's data for one student, or null when it is off for her or she has nothing to show. */
export async function tajweedSummaryFor(studentId: string): Promise<TajweedSummary | null> {
  return (await tajweedSummaryOn(studentId)) ? getTajweedSummary(studentId) : null;
}
