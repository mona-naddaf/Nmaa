import "server-only";
import { attemptCount, recordAttempt, saltedHash } from "@/lib/auth/login-lockout";

// Guessing invite رموز: failed joins are counted per IP and per account (as
// «رفيق الحفظ» sign-in, src/lib/rafiq/limits.ts), so neither many accounts
// from one connection nor one account from many connections can keep trying.
const WINDOW_MS = 15 * 60 * 1000;
const PER_IP = 10;
const PER_ACCOUNT = 5;

const accountKey = (userId: string) => saltedHash(`family-join:${userId}`);

export async function joinLimited(userId: string): Promise<boolean> {
  const [ip, account] = await Promise.all([
    attemptCount("FAMILY_JOIN", WINDOW_MS),
    attemptCount("FAMILY_JOIN", WINDOW_MS, accountKey(userId)),
  ]);
  return ip >= PER_IP || account >= PER_ACCOUNT;
}

export async function recordJoinFailure(userId: string) {
  await Promise.all([recordAttempt("FAMILY_JOIN"), recordAttempt("FAMILY_JOIN", accountKey(userId))]);
}

export const JOIN_TOO_MANY = "محاولات كثيرة برموز غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة";
