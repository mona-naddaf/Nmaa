import "server-only";
import { prisma } from "@/lib/db";
import type { CommitSchedule } from "./streak";

// What her browser needs to work out her commitment days (streak.ts):
// her schedule history, the days she logged a session, and when she signed
// up (her first day is worked out on her own day, commitStart in streak.ts).

export interface CommitmentData {
  schedule: CommitSchedule;
  loggedDays: string[];
  // ISO timestamp of her signup; its day is her browser's (not UTC)
  createdAt: string;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function getCommitment(userId: string): Promise<CommitmentData> {
  const [user, rows, sessions] = await Promise.all([
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
    prisma.rafiqCommitDays.findMany({ where: { userId }, orderBy: { effectiveFrom: "asc" }, select: { days: true, effectiveFrom: true } }),
    // memorization from before (PRIOR) isn't a day of commitment
    prisma.rafiqSession.findMany({ where: { userId, source: "LOGGED" }, distinct: ["day"], select: { day: true } }),
  ]);
  const loggedDays = sessions.map((s) => day(s.day)).sort();
  return {
    schedule: rows.map((r) => ({ from: day(r.effectiveFrom), days: r.days })),
    loggedDays,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Her current weekdays (as of the latest change). */
export async function currentCommitDays(userId: string): Promise<number> {
  const latest = await prisma.rafiqCommitDays.findFirst({ where: { userId }, orderBy: { effectiveFrom: "desc" }, select: { days: true } });
  return latest?.days ?? 127;
}
