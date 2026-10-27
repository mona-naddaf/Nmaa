import "server-only";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/tracker/rules";
import { quietPauses, quietSkips } from "@/lib/excuse/rafiq-data";
import { buildDashboard, dashboardSections, type DashboardData, type DashFacts, type DashRows, type DashViewer } from "./dashboard-build";

// «عائلتي»: the family dashboard, loaded in one batch for the whole family
// (up to 20 adults and 15 children): the family itself, then — in parallel —
// plans, sessions, goals, commitment days, tracker items and ticks of only
// the people this viewer may see (dashboard-build.ts dashboardSections).
// Tracker titles are never selected.

// ticks and items: the last days, plus a day of time-zone slack (as the tracker page)
const TRACKER_DAYS = 9;
const day = (d: Date) => d.toISOString().slice(0, 10);

async function loadFacts(familyId: string): Promise<DashFacts | null> {
  const fam = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      id: true,
      siblingsVisible: true,
      members: {
        orderBy: { joinedAt: "asc" },
        select: { shareProgress: true, shareTracker: true, user: { select: { id: true, name: true, gender: true, createdAt: true, planChangedAt: true } } },
      },
      children: { where: { kind: "CHILD" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, gender: true, createdAt: true, planChangedAt: true } },
    },
  });
  if (!fam) return null;
  return {
    familyId: fam.id,
    siblingsVisible: fam.siblingsVisible,
    children: fam.children,
    adults: fam.members.map((m) => ({ ...m.user, shareProgress: m.shareProgress, shareTracker: m.shareTracker })),
  };
}

async function loadRows(viewer: DashViewer, facts: DashFacts): Promise<DashRows> {
  const s = dashboardSections(viewer, facts);
  const from = new Date(`${addDays(day(new Date()), -TRACKER_DAYS)}T00:00:00Z`);
  const none = Promise.resolve([]);
  const [planItems, sessions, goals, commitDays, trackerItems, checks] = await Promise.all([
    s.sessionSubjects.length ? prisma.rafiqPlanItem.findMany({ where: { userId: { in: s.sessionSubjects } }, select: { userId: true, surahNumber: true, position: true } }) : none,
    s.sessionSubjects.length
      ? prisma.rafiqSession.findMany({
          where: { userId: { in: s.sessionSubjects } },
          select: { userId: true, source: true, type: true, surahNumber: true, fromAyah: true, toAyah: true, situation: true, reason: true, createdAt: true, day: true },
        })
      : none,
    s.progressAdultIds.length ? prisma.rafiqGoal.findMany({ where: { userId: { in: s.progressAdultIds } }, select: { userId: true, target: true, juz: true, surah: true, ayah: true, startDay: true, deadline: true } }) : none,
    s.progressAdultIds.length ? prisma.rafiqCommitDays.findMany({ where: { userId: { in: s.progressAdultIds } }, select: { userId: true, days: true, effectiveFrom: true } }) : none,
    s.trackerSubjects.length
      ? prisma.rafiqTrackerItem.findMany({
          where: { userId: { in: s.trackerSubjects }, OR: [{ archivedAt: null }, { archivedAt: { gte: from } }] },
          orderBy: { createdAt: "asc" },
          // no title: completion only ever leaves the server
          select: { id: true, userId: true, value: true, days: true, createdAt: true, archivedAt: true },
        })
      : none,
    s.trackerSubjects.length ? prisma.rafiqTrackerCheck.findMany({ where: { userId: { in: s.trackerSubjects }, day: { gte: from } }, select: { userId: true, itemId: true, day: true } }) : none,
  ]);
  // «أيام العذر»: a woman sharing her tracker — her excuse stays hers; the scores just leave those items out
  const skipped = await quietSkips(s.trackerAdultIds, day(from));
  // and her paused days: her 🔥 and goal leave as results only
  const paused = await quietPauses(s.progressAdultIds);
  return {
    planItems,
    sessions,
    goals,
    commitDays,
    trackerItems,
    checks,
    ...(Object.keys(skipped).length ? { skipped } : {}),
    ...(Object.keys(paused).length ? { paused } : {}),
  };
}

/** The dashboard of a family for one of its adults (the caller checked she belongs to it). */
export async function familyDashboardForAdult(familyId: string, adultId: string): Promise<DashboardData | null> {
  const facts = await loadFacts(familyId);
  if (!facts || !facts.adults.some((a) => a.id === adultId)) return null;
  const viewer: DashViewer = { kind: "ADULT", id: adultId };
  return buildDashboard(viewer, facts, await loadRows(viewer, facts));
}

/** A child's «عائلتي»: her own family, from her own session (never a URL). */
export async function familyDashboardForChild(familyId: string, childId: string): Promise<DashboardData | null> {
  const facts = await loadFacts(familyId);
  if (!facts || !facts.children.some((c) => c.id === childId)) return null;
  const viewer: DashViewer = { kind: "CHILD", id: childId };
  return buildDashboard(viewer, facts, await loadRows(viewer, facts));
}
