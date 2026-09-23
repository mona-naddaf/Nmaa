import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

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

export async function isParentLoginLocked(): Promise<boolean> {
  const ipHash = await clientIpHash();
  const recent = await prisma.parentLoginAttempt.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  return recent >= MAX_FAILURES;
}

export async function recordParentLoginFailure() {
  const ipHash = await clientIpHash();
  await prisma.parentLoginAttempt.create({ data: { ipHash } });
  // keep the table small; nothing older than the window is ever read
  await prisma.parentLoginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });
}
