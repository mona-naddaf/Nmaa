import "server-only";
import { prisma } from "@/lib/db";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { addDays } from "@/lib/tracker/rules";

// Her own «جدول المتابعة», in the same shape as a course student's sheet so
// the shared TrackerDaySheet shows and scores it unchanged. Scores are never
// stored: the browser works them out on her local days (tracker/rules.ts).

const day = (d: Date) => d.toISOString().slice(0, 10);

export interface RafiqTrackerData {
  sheet: TrackerSheet;
  // her items still in use, for managing them
  active: { id: string; title: string; value: number; days: number }[];
}

/** The last `days` days (plus a day of time-zone slack). */
export async function getRafiqTracker(userId: string, days = 9): Promise<RafiqTrackerData> {
  const fromDay = addDays(day(new Date()), -days);
  const from = new Date(`${fromDay}T00:00:00Z`);
  const [items, checks] = await Promise.all([
    prisma.rafiqTrackerItem.findMany({
      // archived ones still count before their archive day
      where: { userId, OR: [{ archivedAt: null }, { archivedAt: { gte: from } }] },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, value: true, days: true, createdAt: true, archivedAt: true },
    }),
    prisma.rafiqTrackerCheck.findMany({ where: { userId, day: { gte: from } }, select: { itemId: true, day: true } }),
  ]);
  const byDay: Record<string, string[]> = {};
  for (const c of checks) (byDay[day(c.day)] ??= []).push(c.itemId);
  const views: TrackerItemView[] = items.map((r) => ({
    id: r.id,
    title: r.title,
    value: r.value,
    status: "APPROVED",
    days: r.days,
    createdDay: day(r.createdAt),
    archivedDay: r.archivedAt ? day(r.archivedAt) : null,
    reviewedDay: null,
    createdAt: r.createdAt.toISOString(),
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    own: false,
  }));
  return {
    sheet: { items: views, checks: byDay },
    active: items.filter((r) => !r.archivedAt).map(({ id, title, value, days }) => ({ id, title, value, days })),
  };
}
