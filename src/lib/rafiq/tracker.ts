import "server-only";
import { prisma } from "@/lib/db";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { addDays } from "@/lib/tracker/rules";
import { placeOf, type AgendaTime } from "@/lib/tracker/agenda";

// Her own «جدول المتابعة», in the same shape as a course student's sheet so
// the shared TrackerDaySheet shows and scores it unchanged. Scores are never
// stored: the browser works them out on her local days (tracker/rules.ts).

const day = (d: Date) => d.toISOString().slice(0, 10);

export interface RafiqTrackerData {
  sheet: TrackerSheet;
  // her items still in use, for managing them
  active: { id: string; title: string; value: number; days: number; time: AgendaTime | null }[];
}

const timeOf = (slot: { startMin: number | null; durationMin: number | null } | undefined): AgendaTime | null =>
  slot && slot.startMin !== null ? { startMin: slot.startMin, durationMin: slot.durationMin } : null;

/** The last `days` days (plus a day of time-zone slack). */
export async function getRafiqTracker(userId: string, days = 9): Promise<RafiqTrackerData> {
  const fromDay = addDays(day(new Date()), -days);
  const from = new Date(`${fromDay}T00:00:00Z`);
  const [items, checks] = await Promise.all([
    prisma.rafiqTrackerItem.findMany({
      // archived ones still count before their archive day
      where: { userId, OR: [{ archivedAt: null }, { archivedAt: { gte: from } }] },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        value: true,
        days: true,
        createdAt: true,
        archivedAt: true,
        sortOrder: true,
        slots: { where: { weekdays: 127 }, select: { startMin: true, durationMin: true } },
      },
    }),
    prisma.rafiqTrackerCheck.findMany({ where: { userId, day: { gte: from } }, select: { itemId: true, day: true } }),
  ]);
  // her order («الجدول اليومي»; unplaced items last); everyone who never reordered: creation order
  items.sort((a, b) => placeOf(a.sortOrder) - placeOf(b.sortOrder));
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
    sortOrder: r.sortOrder,
    time: timeOf(r.slots[0]),
  }));
  return {
    sheet: { items: views, checks: byDay },
    active: items.filter((r) => !r.archivedAt).map(({ id, title, value, days, slots }) => ({ id, title, value, days, time: timeOf(slots[0]) })),
  };
}
