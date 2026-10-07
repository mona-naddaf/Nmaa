import "server-only";
import { attemptCount, recordAttempt, saltedHash } from "@/lib/auth/login-lockout";

// Abuse limits for public «رفيق الحفظ» sign-up and sign-in, all checked on the
// server. Per IP, and — for anything that guesses a password or recovery
// رمز — also per account, so guesses spread across many addresses still stop.
const MIN = 60 * 1000;

const LIMITS = {
  // failed logins from one IP
  login: { scope: "RAFIQ_LOGIN", max: 10, windowMs: 15 * MIN },
  // failed password / recovery-رمز checks against one account, from anywhere
  account: { scope: "RAFIQ_ACCOUNT", max: 5, windowMs: 15 * MIN },
  // accounts created from one IP (every sign-up counts, not just failures)
  signup: { scope: "RAFIQ_SIGNUP", max: 5, windowMs: 24 * 60 * MIN },
  // failed recoveries from one IP
  recover: { scope: "RAFIQ_RECOVER", max: 5, windowMs: 15 * MIN },
} as const;

type Kind = keyof typeof LIMITS;

const accountKey = (email: string) => saltedHash(`rafiq-account:${email}`);

/** True when this IP (or, for "account", this email) has used up its attempts. */
export async function limited(kind: Kind, email?: string): Promise<boolean> {
  const l = LIMITS[kind];
  const key = kind === "account" ? accountKey(email!) : undefined;
  return (await attemptCount(l.scope, l.windowMs, key)) >= l.max;
}

export async function record(kind: Kind, email?: string) {
  await recordAttempt(LIMITS[kind].scope, kind === "account" ? accountKey(email!) : undefined);
}

export const TOO_MANY = "محاولات كثيرة غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة";
export const TOO_MANY_SIGNUPS = "تم بلوغ الحدّ اليومي لإنشاء الحسابات من هذا الاتصال، يُرجى المحاولة غدًا";
