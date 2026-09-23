"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createParentSession, destroyParentSession } from "@/lib/auth/parent-session";
import { normalizeParentCode, parentNameMatches } from "@/lib/auth/parent-code";
import { isParentLoginLocked, recordParentLoginFailure } from "@/lib/auth/parent-lockout";

export type ParentLoginState = { error?: string } | null;

// Deliberately the only two server actions in the parent area: log in and
// log out. Nothing a parent can trigger writes student data.

export async function parentLoginAction(_prev: ParentLoginState, formData: FormData): Promise<ParentLoginState> {
  const name = String(formData.get("name") ?? "");
  const code = normalizeParentCode(String(formData.get("code") ?? ""));

  if (!name.trim() || !code) {
    return { error: "يُرجى إدخال الاسم ورمز الدخول" };
  }

  if (await isParentLoginLocked()) {
    return { error: "محاولات دخول كثيرة غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة" };
  }

  const student = await prisma.student.findUnique({
    where: { parentCode: code },
    select: { id: true, name: true, parentCodeVersion: true },
  });

  // one generic message for every failure, so the form never reveals
  // whether a code exists
  if (!student || !parentNameMatches(name, student.name)) {
    await recordParentLoginFailure();
    return { error: "الاسم أو رمز الدخول غير صحيح — يُرجى التأكد منهما مع مشرف الدورة" };
  }

  await createParentSession({ studentId: student.id, v: student.parentCodeVersion });
  redirect("/parent");
}

export async function parentLogoutAction() {
  await destroyParentSession();
  redirect("/parent/login");
}
