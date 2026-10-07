"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rafiqEnabled } from "@/lib/rafiq/enabled";
import { createRafiqSession, destroyRafiqSession } from "@/lib/rafiq/session";
import { newRecoveryCode, normalizeRecoveryCode } from "@/lib/rafiq/recovery";
import { limited, record, TOO_MANY, TOO_MANY_SIGNUPS } from "@/lib/rafiq/limits";
import { cleanName, normalizeEmail, parseGender, passwordProblem, validEmail } from "@/lib/rafiq/rules";

// «رفيق الحفظ»: creating an account, signing in, recovering with the
// recovery رمز, and signing out. Every action re-checks that the feature is
// on and applies the limits in src/lib/rafiq/limits.ts.

export type AuthState = { error?: string; recoveryCode?: string; gender?: "MALE" | "FEMALE" } | null;

const OFF: AuthState = { error: "هذه الخدمة غير متاحة حاليًا" };

// compared against when the email has no account, so a wrong email takes as
// long as a wrong password and the timing doesn't reveal which accounts exist
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hashPassword("no-such-account-placeholder"));

export async function rafiqSignupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rafiqEnabled()) return OFF;

  // a field real visitors never see; bots that fill every field are refused
  // (and counted, so they also run into the daily limit)
  if (String(formData.get("website") ?? "") !== "") {
    await record("signup");
    return { error: "تعذّر إنشاء الحساب، يُرجى المحاولة مرة أخرى" };
  }
  if (await limited("signup")) return { error: TOO_MANY_SIGNUPS };

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const gender = parseGender(formData.get("gender"));
  const named = cleanName(formData.get("name"));

  if (!email || !password || !gender) return { error: "يُرجى تعبئة البريد الإلكتروني وكلمة المرور واختيار الجنس" };
  if (!validEmail(email)) return { error: "يُرجى التأكد من البريد الإلكتروني" };
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (password !== confirm) return { error: "كلمتا المرور غير متطابقتين" };
  if ("error" in named) return { error: named.error };

  if (await prisma.rafiqUser.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "يوجد حساب مسجَّل بهذا البريد الإلكتروني مسبقًا" };
  }

  const recovery = await newRecoveryCode();
  let user;
  try {
    user = await prisma.rafiqUser.create({
      data: { email, passwordHash: await hashPassword(password), name: named.name, gender, ...recovery.data, lastLoginAt: new Date() },
      select: { id: true, sessionVersion: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "يوجد حساب مسجَّل بهذا البريد الإلكتروني مسبقًا" };
    }
    throw e;
  }
  await record("signup");
  await createRafiqSession({ uid: user.id, v: user.sessionVersion });
  // shown once on the next screen, then she continues to /rafiq
  return { recoveryCode: recovery.code, gender };
}

export async function rafiqLoginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rafiqEnabled()) return OFF;
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "يُرجى إدخال البريد الإلكتروني وكلمة المرور" };

  if ((await limited("login")) || (await limited("account", email))) return { error: TOO_MANY };

  const user = await prisma.rafiqUser.findUnique({ where: { email }, select: { id: true, passwordHash: true, sessionVersion: true } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummy()));
  if (!user || !ok) {
    await record("login");
    await record("account", email);
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }

  await prisma.rafiqUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createRafiqSession({ uid: user.id, v: user.sessionVersion });
  redirect("/rafiq");
}

/** Sets a new password with the recovery رمز, ends every other session, and issues a new رمز. */
export async function rafiqRecoverAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rafiqEnabled()) return OFF;
  const email = normalizeEmail(formData.get("email"));
  const code = normalizeRecoveryCode(formData.get("code"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!email || !code || !password) return { error: "يُرجى تعبئة جميع الحقول" };
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (password !== confirm) return { error: "كلمتا المرور غير متطابقتين" };

  if ((await limited("recover")) || (await limited("account", email))) return { error: TOO_MANY };

  const user = await prisma.rafiqUser.findUnique({ where: { email }, select: { id: true, recoveryCodeHash: true, gender: true } });
  const ok = await verifyPassword(code, user?.recoveryCodeHash ?? (await dummy()));
  if (!user || !ok) {
    await record("recover");
    await record("account", email);
    return { error: "البريد الإلكتروني أو رمز الاستعادة غير صحيح" };
  }

  const recovery = await newRecoveryCode();
  const updated = await prisma.rafiqUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 }, ...recovery.data, lastLoginAt: new Date() },
    select: { sessionVersion: true },
  });
  await createRafiqSession({ uid: user.id, v: updated.sessionVersion });
  return { recoveryCode: recovery.code, gender: user.gender };
}

export async function rafiqLogoutAction() {
  await destroyRafiqSession();
  redirect("/rafiq/login");
}
