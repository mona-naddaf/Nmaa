"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeAccessCode } from "@/lib/auth/access-code";
import { parentNameMatches } from "@/lib/auth/parent-code";
import { isLoginLocked, recordLoginFailure } from "@/lib/auth/login-lockout";
import { familyEnabled } from "@/lib/family/enabled";
import { createChildSession, destroyChildSession } from "@/lib/family/child-session";

// «العائلة»: a child logs in with her name and her رمز (given by the family's
// adults), as a course student does. Everything else she does goes through
// the Rafiq actions, as herself (src/lib/rafiq/subject.ts).

export type ChildLoginState = { error?: string } | null;

export async function childLoginAction(_prev: ChildLoginState, formData: FormData): Promise<ChildLoginState> {
  if (!familyEnabled()) return { error: "الدخول غير متاح حاليًا" };
  const name = String(formData.get("name") ?? "");
  const code = normalizeAccessCode(String(formData.get("code") ?? ""));
  if (!name.trim() || !code) return { error: "يُرجى كتابة الاسم ورمز الدخول" };

  if (await isLoginLocked("FAMILY_CHILD_LOGIN")) {
    return { error: "محاولات كثيرة غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة" };
  }

  const child = await prisma.rafiqUser.findUnique({
    where: { childCode: code },
    select: { id: true, kind: true, name: true, familyId: true, childCodeVersion: true },
  });
  // one message for every failure, so the form never reveals whether a رمز
  // exists; the name is matched leniently (the رمز is the real secret)
  if (!child || child.kind !== "CHILD" || !child.familyId || !child.name || !parentNameMatches(name, child.name)) {
    await recordLoginFailure("FAMILY_CHILD_LOGIN");
    return { error: "الاسم أو رمز الدخول غير صحيح — يُرجى التأكد منهما مع أهلك" };
  }

  await prisma.rafiqUser.update({ where: { id: child.id }, data: { lastLoginAt: new Date() } });
  await createChildSession({ uid: child.id, v: child.childCodeVersion });
  redirect("/family");
}

export async function childLogoutAction() {
  await destroyChildSession();
  redirect("/family/login");
}
