"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { issueStudentCode, revokeStudentCode } from "@/lib/auth/student-code";
import { inScope, studentCodeAccess } from "@/lib/students/student-codes";

export type StudentCodeResult = { error: string } | { code: string | null; createdAt: string | null };

// Supervisor, or a teacher when the course allows it — and then only for
// active students in her own groups. Checked here, whatever the UI showed.
type CodeTarget = { error: string } | { student: { id: string; groupId: string } };

async function codeTarget(studentId: string): Promise<CodeTarget> {
  const session = await requireSession();
  const access = await studentCodeAccess(session);
  if (!access.allowed) return { error: "ليست لديك صلاحية إصدار رموز الطلاب" };
  const student = await prisma.student.findFirst({
    where: { id: String(studentId ?? ""), courseId: session.courseId, archivedAt: null },
    select: { id: true, groupId: true },
  });
  if (!student) return { error: "لم يُعثر على هذا السجل" };
  if (!inScope(access, student.groupId)) return { error: "ليست لديك صلاحية إصدار رموز لهذه المجموعة" };
  return { student };
}

function refresh(studentId: string) {
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students/student-codes");
}

/** Issues a fresh code; bumping the version ends sessions opened with the old one. */
export async function regenerateStudentCodeAction(studentId: string): Promise<StudentCodeResult> {
  const target = await codeTarget(studentId);
  if ("error" in target) return { error: target.error };
  const issued = await issueStudentCode(target.student.id);
  if (!issued) return { error: "تعذّر إنشاء الرمز، يُرجى المحاولة مرة أخرى" };
  refresh(target.student.id);
  return { code: issued.code, createdAt: issued.createdAt.toISOString() };
}

export async function revokeStudentCodeAction(studentId: string): Promise<StudentCodeResult> {
  const target = await codeTarget(studentId);
  if ("error" in target) return { error: target.error };
  await revokeStudentCode(target.student.id);
  refresh(target.student.id);
  return { code: null, createdAt: null };
}
