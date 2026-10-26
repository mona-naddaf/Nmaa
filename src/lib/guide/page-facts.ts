import "server-only";
import { prisma } from "@/lib/db";
import type { ChecklistFacts } from "./lines";

// What the page-level guidance reads from her own data (src/lib/guide/lines):
// the counts «الخطوات الأولى» ticks from, and the few facts some intro lines
// wait for. Called by the pages only while guidance is on (and the checklist
// only for a new account), so with it off nothing here is ever read.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function checklistFacts(userId: string): Promise<ChecklistFacts> {
  const [sessions, trackerItems, trackerChecks, timedItems] = await Promise.all([
    prisma.rafiqSession.count({ where: { userId, source: "LOGGED" } }),
    prisma.rafiqTrackerItem.count({ where: { userId, archivedAt: null } }),
    prisma.rafiqTrackerCheck.count({ where: { userId } }),
    prisma.rafiqTrackerItem.count({ where: { userId, archivedAt: null, slots: { some: {} } } }),
  ]);
  return { sessions, trackerItems, trackerChecks, timedItems };
}

/** A word flagged in any of her sessions, ever (the detailed-tajweed line waits for one). */
export async function hasFlaggedWords(userId: string): Promise<boolean> {
  return (await prisma.rafiqMistake.count({ where: { userId }, take: 1 })) > 0;
}

/** Her current items, and whole days since the oldest of them was added. */
export async function trackerIntroFacts(userId: string): Promise<{ trackerItems: number; trackerDays: number }> {
  const [trackerItems, oldest] = await Promise.all([
    prisma.rafiqTrackerItem.count({ where: { userId, archivedAt: null } }),
    prisma.rafiqTrackerItem.findFirst({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  return { trackerItems, trackerDays: oldest ? Math.floor((Date.now() - oldest.createdAt.getTime()) / DAY_MS) : 0 };
}
