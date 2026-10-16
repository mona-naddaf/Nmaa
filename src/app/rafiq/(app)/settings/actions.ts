"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createRafiqSession, destroyRafiqSession } from "@/lib/rafiq/session";
import { resolveSubject } from "@/lib/rafiq/subject";
import { newRecoveryCode } from "@/lib/rafiq/recovery";
import { checkPassword } from "@/lib/rafiq/password-check";
import { cleanName, DELETE_CONFIRM_WORD, parseGender, passwordProblem } from "@/lib/rafiq/rules";
import { validateDays } from "@/lib/tracker/rules";
import { acceptLocalDay } from "@/lib/home-log/rules";
import { validateLocation } from "@/lib/prayer/times";
import { placeColumns } from "@/lib/prayer/location";

// Her own account settings. Every action resolves whose settings they are
// (src/lib/rafiq/subject.ts): the account itself (profile, password, recovery
// رمز, sign-out, deletion, prayer place) is hers only; the feature settings
// may also be a child's («العائلة», subjectId), set by an adult with edit
// rights. Anything that changes the password, the recovery رمز or deletes the
// account first asks for her current password (counted against the
// per-account limit).

export type SettingsState = { error?: string; ok?: string; recoveryCode?: string } | null;

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
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
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const weak = passwordProblem(next);
  if (weak) return { error: weak };
  if (next !== confirm) return { error: "كلمتا المرور غير متطابقتين" };
  const wrong = await checkPassword(user.account, current);
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
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  const wrong = await checkPassword(user.account, String(formData.get("current") ?? ""));
  if (wrong) return { error: wrong };
  const recovery = await newRecoveryCode();
  await prisma.rafiqUser.update({ where: { id: user.id }, data: recovery.data });
  return { recoveryCode: recovery.code };
}

/** Ends every session, this one included. */
export async function signOutEverywhereAction() {
  const user = await resolveSubject(null, "self");
  if (!("error" in user)) await prisma.rafiqUser.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await destroyRafiqSession();
  redirect("/rafiq/login");
}

/** Deletes the account and everything in it, permanently. */
export async function deleteAccountAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  if (String(formData.get("confirmWord") ?? "").trim() !== DELETE_CONFIRM_WORD) {
    return { error: `يُرجى كتابة كلمة «${DELETE_CONFIRM_WORD}» للتأكيد` };
  }
  const wrong = await checkPassword(user.account, String(formData.get("current") ?? ""));
  if (wrong) return { error: wrong };
  // «العائلة»: a founder hands the role over or deletes the family first
  // (Family.founderId is Restrict, so the delete below would fail anyway).
  // Only after the password, so nothing about her families shows before it.
  if ((await prisma.family.count({ where: { founderId: user.id } })) > 0) {
    return { error: "يُرجى نقل دور المؤسِّس في عائلتك إلى بالغ آخر أو حذف العائلة قبل حذف الحساب" };
  }
  // every Rafiq table hangs off RafiqUser with onDelete: Cascade
  await prisma.rafiqUser.delete({ where: { id: user.id } });
  await destroyRafiqSession();
  redirect("/");
}

/** Review reminders: off (null) or the number of days (1–90) a completed surah may go unreviewed. */
export async function setReviewRemindersAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(formData.get("subjectId"), "manage");
  if ("error" in user) return user;
  const on = formData.get("on") === "1";
  const days = Number(formData.get("days"));
  if (on && (!Number.isInteger(days) || days < 1 || days > 90)) return { error: "يُرجى إدخال عدد أيام بين 1 و90" };
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { reviewReminderDays: on ? days : null } });
  revalidatePath("/rafiq", "layout");
  return { ok: on ? "تم تفعيل تذكير المراجعة ✓" : "تم إيقاف تذكير المراجعة ✓" };
}

/** «مواقيت الصلاة»: her place (a city or a custom place), or null to remove it. */
export async function setPlaceAction(input: unknown): Promise<{ error?: string }> {
  // her own place only: a child uses the family's («العائلة»)
  const user = await resolveSubject(null, "self");
  if ("error" in user) return user;
  const loc = input === null ? null : validateLocation(input);
  if (input !== null && !loc) return { error: "يُرجى اختيار مدينة صحيحة أو إدخال إحداثيات صحيحة" };
  await prisma.rafiqUser.update({ where: { id: user.id }, data: placeColumns(loc) });
  revalidatePath("/rafiq", "layout");
  return {};
}

/** «المحصّلات» of her tracker: on or off (off by default). */
export async function setSummaryEnabledAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(formData.get("subjectId"), "manage");
  if ("error" in user) return user;
  const on = formData.get("on") === "1";
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { summaryEnabled: on } });
  revalidatePath("/rafiq", "layout");
  return { ok: on ? "تم تفعيل المحصّلات ✓" : "تم إيقاف المحصّلات ✓" };
}

/** «الجدول اليومي» on her tracker page: on or off (off by default). */
export async function setAgendaEnabledAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(formData.get("subjectId"), "manage");
  if ("error" in user) return user;
  const on = formData.get("on") === "1";
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { agendaEnabled: on } });
  revalidatePath("/rafiq", "layout");
  return { ok: on ? "تم تفعيل الجدول اليومي ✓" : "تم إيقاف الجدول اليومي ✓" };
}

/**
 * The weekdays she intends to commit to, from her today onward (earlier
 * days keep the schedule they had). today: her browser's local date.
 */
export async function setCommitDaysAction(input: { days: number; today: string; subjectId?: string }): Promise<SettingsState> {
  const user = await resolveSubject(input?.subjectId, "manage");
  if ("error" in user) return user;
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

/** «المتشابهات» marks on her verses: on or off (off by default). */
export async function setMutashabihatEnabledAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(formData.get("subjectId"), "manage");
  if ("error" in user) return user;
  const on = formData.get("on") === "1";
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { mutashabihatEnabled: on } });
  revalidatePath("/rafiq", "layout");
  return { ok: on ? "تم تفعيل المتشابهات ✓" : "تم إيقاف المتشابهات ✓" };
}

/** «أخطاء التجويد المفصّلة» in her sessions and home practice: on or off (off by default). */
export async function setTajweedDetailEnabledAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await resolveSubject(formData.get("subjectId"), "manage");
  if ("error" in user) return user;
  const on = formData.get("on") === "1";
  await prisma.rafiqUser.update({ where: { id: user.id }, data: { tajweedDetailEnabled: on } });
  revalidatePath("/rafiq", "layout");
  return { ok: on ? "تم تفعيل أخطاء التجويد المفصّلة ✓" : "تم إيقاف أخطاء التجويد المفصّلة ✓" };
}
