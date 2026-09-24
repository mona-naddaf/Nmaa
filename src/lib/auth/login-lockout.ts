import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { LoginScope } from "@prisma/client";

// Brute-force lockout for the code-only logins (parent, public board).
// Counted per scope, so failures on one login never lock out the other.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

// Salted with SESSION_SECRET so the stored value can't be reversed into an
// IP address by anyone reading the table.
async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.SESSION_SECRET}:${ip}`).digest("hex").slice(0, 32);
}

export async function isLoginLocked(scope: LoginScope): Promise<boolean> {
  const ipHash = await clientIpHash();
  const recent = await prisma.loginAttempt.count({
    where: { scope, ipHash, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  return recent >= MAX_FAILURES;
}

export async function recordLoginFailure(scope: LoginScope) {
  const ipHash = await clientIpHash();
  await prisma.loginAttempt.create({ data: { scope, ipHash } });
  // keep the table small; nothing older than the window is ever read
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });
}
