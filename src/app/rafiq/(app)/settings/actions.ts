"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createRafiqSession, destroyRafiqSession, getRafiqUser } from "@/lib/rafiq/session";
import { newRecoveryCode } from "@/lib/rafiq/recovery";
import { limited, record, TOO_MANY } from "@/lib/rafiq/limits";
import { cleanName, DELETE_CONFIRM_WORD, parseGender, passwordProblem } from "@/lib/rafiq/rules";
import { validateDays } from "@/lib/tracker/rules";
import { acceptLocalDay } from "@/lib/home-log/rules";

// Her own account settings. Every action re-checks her session; anything
// that changes the password, the recovery رمز or deletes the account first
// asks for her current password (counted against the per-account limit).

export type SettingsState = { error?: string; ok?: string; recoveryCode?: string } | null;

const SIGNED_OUT: SettingsState = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };

/** Her current password is right (and she hasn't run out of attempts). */
async function checkPassword(user: { id: string; email: string }, password: string): Promise<string | null> {
  if (await limited("account", user.email)) return TOO_MANY;
  const row = await prisma.rafiqUser.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    await record("account", user.email);
    return "كلمة المرور الحالية غير صحيحة";
  }
  return null;
}

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const named = cleanName(formData.get("name"));
  const gender = parseGender(formData.get("gender"));
  if ("error" in named) return { error: named.error };
  if (!gender) return { error: "يُرجى اختيار الجنس" };
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { name: named.name, gender } });
  revalidatePath("/rafiq", "layout");
  return { ok: "تم حفظ البيانات ✓" };
}

/** New password; every other device is signed out, this one stays in. */
export async function changePasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const weak = passwordProblem(next);
  if (weak) return { error: weak };
  if (next !== confirm) return { error: "كلمتا المرور غير متطابقتين" };
  const wrong = await checkPassword(user, current);
  if (wrong) return { error: wrong };

  const updated = await prisma.rafiqUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await createRafiqSession({ uid: user.id, v: updated.sessionVersion });
  return { ok: "تم تغيير كلمة المرور ✓ وخرجت الأجهزة الأخرى من الحساب" };
}

/** Replaces the recovery رمز; the new one is shown once. */
export async function regenerateRecoveryCodeAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const wrong = await checkPassword(user, String(formData.get("current") ?? ""));
  if (wrong) return { error: wrong };
  const recovery = await newRecoveryCode();
  await prisma.rafiqUser.update({ where: { id: user.id }, data: recovery.data });
  return { recoveryCode: recovery.code };
}

/** Ends every session, this one included. */
export async function signOutEverywhereAction() {
  const user = await getRafiqUser();
  if (user) await prisma.rafiqUser.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await destroyRafiqSession();
  redirect("/rafiq/login");
}

/** Deletes the account and everything in it, permanently. */
export async function deleteAccountAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  if (String(formData.get("confirmWord") ?? "").trim() !== DELETE_CONFIRM_WORD) {
    return { error: `يُرجى كتابة كلمة «${DELETE_CONFIRM_WORD}» للتأكيد` };
  }
  const wrong = await checkPassword(user, String(formData.get("current") ?? ""));
  if (wrong) return { error: wrong };
  // every Rafiq table hangs off RafiqUser with onDelete: Cascade
  await prisma.rafiqUser.delete({ where: { id: user.id } });
  await destroyRafiqSession();
  redirect("/");
}

/** Review reminders: off (null) or the number of days (1–90) a completed surah may go unreviewed. */
export async function setReviewRemindersAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const on = formData.get("on") === "1";
  const days = Number(formData.get("days"));
  if (on && (!Number.isInteger(days) || days < 1 || days > 90)) return { error: "يُرجى إدخال عدد أيام بين 1 و90" };
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { reviewReminderDays: on ? days : null } });
  revalidatePath("/rafiq", "layout");
  return { ok: on ? "تم تفعيل تذكير المراجعة ✓" : "تم إيقاف تذكير المراجعة ✓" };
}

/**
 * The weekdays she intends to commit to, from her today onward (earlier
 * days keep the schedule they had). today: her browser's local date.
 */
export async function setCommitDaysAction(input: { days: number; today: string }): Promise<SettingsState> {
  const user = await getRafiqUser();
  if (!user) return SIGNED_OUT;
  const days = validateDays(input?.days);
  if (days === null) return { error: "يُرجى اختيار يوم واحد على الأقل" };
  const today = acceptLocalDay(String(input?.today ?? ""));
  if (!today) return { error: "يُرجى تحديث الصفحة والمحاولة مرة أخرى" };
  const effectiveFrom = new Date(`${today}T00:00:00Z`);
  await prisma.rafiqCommitDays.upsert({
    where: { userId_effectiveFrom: { userId: user.id, effectiveFrom } },
    create: { userId: user.id, days, effectiveFrom },
    update: { days },
  });
  revalidatePath("/rafiq", "layout");
  return { ok: "تم حفظ أيام الالتزام ✓" };
}
