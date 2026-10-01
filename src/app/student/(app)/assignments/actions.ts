"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getStudentAccess } from "@/lib/auth/student-session";
import { assignmentsForStudentWhere } from "@/lib/assignments/data";

// The student ticks an assignment done, or unticks it. Re-checks her
// session, that the course has assignments on, and that the assignment
// reaches her now. D5: reaching a QURAN segment's targets never ticks it —
// only she does. No points are given.

export type DoneResult = { error?: string };

export async function setAssignmentDoneAction(assignmentId: string, done: boolean): Promise<DoneResult> {
  const access = await getStudentAccess();
  if (!access || !access.assignmentsEnabled) return { error: "الواجبات غير متاحة حاليًا" };
  const a = await prisma.assignment.findFirst({
    where: { id: String(assignmentId ?? ""), ...assignmentsForStudentWhere({ id: access.studentId, courseId: access.courseId, groupId: access.groupId }) },
    select: { id: true },
  });
  if (!a) return { error: "هذا الواجب غير متاح" };

  if (done === true) {
    await prisma.assignmentCompletion.upsert({
      where: { assignmentId_studentId: { assignmentId: a.id, studentId: access.studentId } },
      create: { assignmentId: a.id, studentId: access.studentId },
      update: {},
    });
  } else {
    await prisma.assignmentCompletion.deleteMany({ where: { assignmentId: a.id, studentId: access.studentId } });
  }
  revalidatePath("/student/assignments");
  return {};
}
