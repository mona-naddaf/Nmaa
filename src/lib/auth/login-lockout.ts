import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { LoginScope } from "@prisma/client";

// Brute-force lockout for the logins (parent, public board, student,
// supervisor). Counted per scope, so failures on one login never lock out
// another. «رفيق الحفظ» builds its own limits on the general helpers below
// (src/lib/rafiq/limits.ts).
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

// Salted with SESSION_SECRET so the stored value can't be reversed into an
// IP address (or an email) by anyone reading the table.
export function saltedHash(value: string): string {
  return createHash("sha256").update(`${process.env.SESSION_SECRET}:${value}`).digest("hex").slice(0, 32);
}

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return saltedHash(ip);
}

/** Attempts recorded in `scope` within the window, for `keyHash` (default: this client's IP). */
export async function attemptCount(scope: LoginScope, windowMs: number, keyHash?: string): Promise<number> {
  const ipHash = keyHash ?? (await clientIpHash());
  return prisma.loginAttempt.count({
    where: { scope, ipHash, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
}

/** Records one attempt in `scope` for `keyHash` (default: this client's IP). */
export async function recordAttempt(scope: LoginScope, keyHash?: string) {
  const ipHash = keyHash ?? (await clientIpHash());
  await prisma.loginAttempt.create({ data: { scope, ipHash } });
  // keep the table small; nothing older than a day is ever read
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });
}

export async function isLoginLocked(scope: LoginScope): Promise<boolean> {
  return (await attemptCount(scope, WINDOW_MS)) >= MAX_FAILURES;
}

export async function recordLoginFailure(scope: LoginScope) {
  await recordAttempt(scope);
}
