"use server";

import { prisma } from "@/lib/db";
import { getStaffScope, inScope, NO_GROUP_ACCESS } from "@/lib/staff-scope";
import { courseSummary, type SummaryPayload } from "@/lib/tracker/summary-data";
import { clampOffset, isPeriodKind } from "@/lib/tracker/summary";

/**
 * «المحصّلات» of one student, for her teacher or the supervisor: the course
 * has the tracker and the summaries on, and she is in one of the viewer's
 * groups (a group-limited teacher sees her groups only).
 */
export async function studentSummaryAction(studentId: string, kind: unknown, offset: unknown): Promise<SummaryPayload | { error: string }> {
  const scope = await getStaffScope("tracker");
  if (!scope) return { error: "جدول المتابعة غير مفعّل في هذه الدورة" };
  const course = await prisma.course.findUniqueOrThrow({ where: { id: scope.courseId }, select: { trackerSummaryEnabled: true } });
  if (!course.trackerSummaryEnabled) return { error: "المحصّلات غير مفعّلة في هذه الدورة" };
  if (!isPeriodKind(kind)) return { error: "فترة غير صحيحة" };
  const student = await prisma.student.findFirst({ where: { id: String(studentId ?? ""), courseId: scope.courseId }, select: { id: true, groupId: true } });
  if (!student || !inScope(scope, student.groupId)) return { error: NO_GROUP_ACCESS };
  return courseSummary(student.id, kind, clampOffset(offset));
}
