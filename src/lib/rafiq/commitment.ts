import "server-only";
import { prisma } from "@/lib/db";
import type { CommitSchedule } from "./streak";

// What her browser needs to work out her commitment days (streak.ts):
// her schedule history, the days she logged a session, and her first day.

export interface CommitmentData {
  schedule: CommitSchedule;
  loggedDays: string[];
  start: string;
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
  const created = day(user.createdAt);
  return {
    schedule: rows.map((r) => ({ from: day(r.effectiveFrom), days: r.days })),
    loggedDays,
    // a session backdated before she signed up still counts from its day
    start: loggedDays.length && loggedDays[0] < created ? loggedDays[0] : created,
  };
}

/** Her current weekdays (as of the latest change). */
export async function currentCommitDays(userId: string): Promise<number> {
  const latest = await prisma.rafiqCommitDays.findFirst({ where: { userId }, orderBy: { effectiveFrom: "desc" }, select: { days: true } });
  return latest?.days ?? 127;
}
