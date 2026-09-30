"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { studentNameKey } from "@/lib/students/new-student";

export type ArchiveResult = { error?: string };

// All supervisor-only, and only ever on an archived student of the
// supervisor's own course.
async function archivedStudent(studentId: string) {
  const session = await requireAdmin();
  return prisma.student.findFirst({
    where: { id: studentId, courseId: session.courseId, archivedAt: { not: null } },
    select: { id: true, name: true },
  });
}

function refreshAll(studentId: string) {
  revalidatePath("/students", "layout");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/reports");
}

export async function restoreStudentAction(studentId: string): Promise<ArchiveResult> {
  const student = await archivedStudent(studentId);
  if (!student) return { error: "لم يُعثر على هذا السجل في الأرشيف" };
  // keepInReports only means something while archived; reset it for next time
  await prisma.student.update({ where: { id: student.id }, data: { archivedAt: null, keepInReports: true } });
  refreshAll(student.id);
  return {};
}

export async function setKeepInReportsAction(studentId: string, keep: boolean): Promise<ArchiveResult> {
  const student = await archivedStudent(studentId);
  if (!student) return { error: "لم يُعثر على هذا السجل في الأرشيف" };
  await prisma.student.update({ where: { id: student.id }, data: { keepInReports: keep === true } });
  revalidatePath("/students/archive");
  revalidatePath("/reports");
  return {};
}

// Removes the student and, by cascade, her plan, recitations, points,
// attendance and mistakes. Only for archived students, and only when the
// typed confirmation matches her name.
export async function deleteStudentPermanentlyAction(studentId: string, typedName: string): Promise<ArchiveResult> {
  const student = await archivedStudent(studentId);
  if (!student) return { error: "لم يُعثر على هذا السجل في الأرشيف" };
  if (studentNameKey(String(typedName ?? "")) !== studentNameKey(student.name)) {
    return { error: "الاسم المكتوب لا يطابق الاسم المسجَّل" };
  }
  await prisma.student.delete({ where: { id: student.id } });
  refreshAll(student.id);
  return {};
}
