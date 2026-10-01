"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createStudentSession, destroyStudentSession } from "@/lib/auth/student-session";
import { normalizeStudentCode } from "@/lib/auth/student-code";
import { parentNameMatches } from "@/lib/auth/parent-code";
import { isLoginLocked, recordLoginFailure } from "@/lib/auth/login-lockout";

export type StudentLoginState = { error?: string } | null;

// The student area's only server actions in phase 1: log in and log out.
// Nothing a student can trigger writes data yet.

export async function studentLoginAction(_prev: StudentLoginState, formData: FormData): Promise<StudentLoginState> {
  const name = String(formData.get("name") ?? "");
  const code = normalizeStudentCode(String(formData.get("code") ?? ""));

  if (!name.trim() || !code) {
    return { error: "يُرجى إدخال الاسم ورمز الدخول" };
  }

  if (await isLoginLocked("STUDENT")) {
    return { error: "محاولات دخول كثيرة غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة" };
  }

  const student = await prisma.student.findUnique({
    where: { studentCode: code },
    select: { id: true, name: true, studentCodeVersion: true, archivedAt: true, course: { select: { studentLoginEnabled: true } } },
  });

  // One generic message for every failure (wrong code or name, archived
  // student, student login off in the course), so the form never reveals
  // whether a code exists. Name matching is lenient, as for parents: the code
  // is the real secret.
  if (!student || student.archivedAt || !student.course.studentLoginEnabled || !parentNameMatches(name, student.name)) {
    await recordLoginFailure("STUDENT");
    return { error: "الاسم أو رمز الدخول غير صحيح — يُرجى التأكد منهما مع المعلم أو مشرف الدورة" };
  }

  await createStudentSession({ studentId: student.id, v: student.studentCodeVersion });
  redirect("/student");
}

export async function studentLogoutAction() {
  await destroyStudentSession();
  redirect("/student/login");
}
