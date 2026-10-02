"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createParentSession, destroyParentSession, getParentStudentId } from "@/lib/auth/parent-session";
import { normalizeParentCode, parentNameMatches } from "@/lib/auth/parent-code";
import { isLoginLocked, recordLoginFailure } from "@/lib/auth/login-lockout";
import {
  getStudentInfoValues,
  parentInfoAccess,
  plainValues,
  visibleInfoFields,
  writeInfoChanges,
} from "@/lib/students/extra-info";
import { validateInfoSave } from "@/lib/students/extra-info-rules";

export type ParentLoginState = { error?: string } | null;

// The parent area has three server actions: log in, log out, and saving the
// «معلومات الطالب/ة» fields (below) — the only student data a parent can
// write, and only while the course allows it.

export async function parentLoginAction(_prev: ParentLoginState, formData: FormData): Promise<ParentLoginState> {
  const name = String(formData.get("name") ?? "");
  const code = normalizeParentCode(String(formData.get("code") ?? ""));

  if (!name.trim() || !code) {
    return { error: "يُرجى إدخال الاسم ورمز الدخول" };
  }

  if (await isLoginLocked("PARENT")) {
    return { error: "محاولات دخول كثيرة غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة" };
  }

  const student = await prisma.student.findUnique({
    where: { parentCode: code },
    select: { id: true, name: true, parentCodeVersion: true, archivedAt: true },
  });

  // one generic message for every failure, so the form never reveals
  // whether a code exists
  // an archived student's code is paused (kept, so a restore brings it back);
  // it fails exactly like a wrong code
  if (!student || student.archivedAt || !parentNameMatches(name, student.name)) {
    await recordLoginFailure("PARENT");
    return { error: "الاسم أو رمز الدخول غير صحيح — يُرجى التأكد منهما مع مشرف الدورة" };
  }

  await createParentSession({ studentId: student.id, v: student.parentCodeVersion });
  redirect("/parent");
}

export async function parentLogoutAction() {
  await destroyParentSession();
  redirect("/parent/login");
}

export type ParentInfoResult = { error?: string };

// Saves the extra-info fields shown to parents, directly (no approval). Every
// call re-checks the parent session (a revoked/regenerated code or an
// archived student ends it), that the course has the feature and parent
// editing on, and which fields are enabled and shown to parents; any other
// submitted field is ignored. Required fields among those must stay filled.
export async function saveParentStudentInfoAction(values: Record<string, string>): Promise<ParentInfoResult> {
  const studentId = await getParentStudentId();
  if (!studentId) return { error: "انتهت الجلسة — يُرجى تسجيل الدخول مرة أخرى" };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      group: { select: { gender: true } },
      course: { select: { id: true, studentInfoEnabled: true, parentStudentInfoEdit: true } },
    },
  });
  if (!student) return { error: "انتهت الجلسة — يُرجى تسجيل الدخول مرة أخرى" };

  const access = parentInfoAccess(student.course);
  if (!access.edit) return { error: "تعديل المعلومات غير متاح حاليًا" };
  const fields = await visibleInfoFields(student.course.id, access);
  const current = plainValues(await getStudentInfoValues(studentId, fields));
  const submitted = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const result = validateInfoSave(fields, current, submitted, student.group.gender);
  if ("error" in result) return { error: result.error };

  if (result.changes.length > 0) {
    await prisma.$transaction((tx) => writeInfoChanges(tx, studentId, result.changes, "PARENT"));
    revalidatePath("/parent");
    revalidatePath("/students/[id]", "page");
  }
  return {};
}
