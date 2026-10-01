"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { teacherGroupLimit } from "@/lib/students/manage";
import { validateTargets, type HomeTargets } from "@/lib/home-log/rules";

// D2: the supervisor, or a teacher within her visible groups, sets a
// student's home-log targets (for her new segments) and adjusts an active
// segment's targets. Re-checked here whatever the page showed.

export type TargetsResult = { error?: string };

async function staffStudent(studentId: string) {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: { homeLogEnabled: true, studentLoginEnabled: true, visibilityMode: true },
  });
  if (!course.homeLogEnabled || !course.studentLoginEnabled) return { error: "حفظ البيت غير مفعّل في هذه الدورة" } as const;
  const student = await prisma.student.findFirst({
    where: { id: String(studentId ?? ""), courseId: session.courseId, archivedAt: null },
    select: { id: true, groupId: true },
  });
  if (!student) return { error: "لم يُعثر على هذا السجل" } as const;
  const limit = await teacherGroupLimit(session, course);
  if (limit && !limit.includes(student.groupId)) return { error: "ليست لديك صلاحية على هذه المجموعة" } as const;
  return { student } as const;
}

/** targets null = back to the course defaults. Applies to her new segments. */
export async function setStudentHomeTargetsAction(studentId: string, targets: HomeTargets | null): Promise<TargetsResult> {
  const found = await staffStudent(studentId);
  if ("error" in found) return { error: found.error };
  const t = targets === null ? null : validateTargets(targets);
  if (targets !== null && !t) return { error: "يُرجى إدخال أهداف صحيحة بين 1 و100" };
  await prisma.student.update({
    where: { id: found.student.id },
    data: { homeTargetListen: t?.listen ?? null, homeTargetRepeat: t?.repeat ?? null, homeTargetRecite: t?.recite ?? null },
  });
  revalidatePath(`/students/${found.student.id}`);
  return {};
}

export async function setSegmentTargetsAction(segmentId: string, targets: HomeTargets): Promise<TargetsResult> {
  const segment = await prisma.homeSegment.findFirst({
    where: { id: String(segmentId ?? ""), finishedAt: null },
    select: { id: true, studentId: true },
  });
  if (!segment) return { error: "هذا المقطع غير متاح" };
  const found = await staffStudent(segment.studentId);
  if ("error" in found) return { error: found.error };
  const t = validateTargets(targets);
  if (!t) return { error: "يُرجى إدخال أهداف صحيحة بين 1 و100" };
  await prisma.homeSegment.update({
    where: { id: segment.id },
    data: { targetListen: t.listen, targetRepeat: t.repeat, targetRecite: t.recite },
  });
  revalidatePath(`/students/${segment.studentId}`);
  return {};
}
