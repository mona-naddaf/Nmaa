import "server-only";
import { prisma } from "@/lib/db";
import { EMPTY_COUNTS, allTargetsMet, type HomeCounts, type HomeTapKind, type HomeTargets } from "./rules";

// The only place home-log data is read for display (student, staff and
// parent views all use this). Counts are derived from HomeTap rows; nothing
// here — or anything reading these tables — feeds the official position.

export interface HomeSegmentView {
  id: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  targets: HomeTargets;
  // whole-segment counters (the ones with targets)
  counts: HomeCounts;
  // free per-ayah practice, keyed by ayah number (only ayat with taps)
  ayahCounts: Record<number, HomeCounts>;
  targetsMet: boolean;
  createdAt: string; // YYYY-MM-DD
  finishedAt: string | null;
  finishedBy: "STUDENT" | "TEACHER_RECITED" | null;
  lastActivity: string | null; // YYYY-MM-DD (her local day of the latest tap)
  // set when a teacher's QURAN assignment created it (shown as «واجب»)
  assignmentId: string | null;
}

export interface HomeLogView {
  active: HomeSegmentView[];
  past: HomeSegmentView[];
  lastActivity: string | null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Course default targets, overridden per field by the student's own. */
export async function effectiveTargets(studentId: string): Promise<HomeTargets> {
  const s = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      homeTargetListen: true,
      homeTargetRepeat: true,
      homeTargetRecite: true,
      course: { select: { homeTargetListen: true, homeTargetRepeat: true, homeTargetRecite: true } },
    },
  });
  return {
    listen: s.homeTargetListen ?? s.course.homeTargetListen,
    repeat: s.homeTargetRepeat ?? s.course.homeTargetRepeat,
    recite: s.homeTargetRecite ?? s.course.homeTargetRecite,
  };
}

export async function getHomeLog(studentId: string, { pastLimit = 30 }: { pastLimit?: number } = {}): Promise<HomeLogView> {
  const [activeRows, pastRows] = await Promise.all([
    prisma.homeSegment.findMany({ where: { studentId, finishedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.homeSegment.findMany({ where: { studentId, finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, take: pastLimit }),
  ]);
  const rows = [...activeRows, ...pastRows];
  const ids = rows.map((r) => r.id);

  const [grouped, latest, lastTap] = await Promise.all([
    ids.length
      ? prisma.homeTap.groupBy({ by: ["segmentId", "ayah", "kind"], where: { segmentId: { in: ids } }, _count: { _all: true } })
      : Promise.resolve([]),
    ids.length
      ? prisma.homeTap.groupBy({ by: ["segmentId"], where: { segmentId: { in: ids } }, _max: { day: true } })
      : Promise.resolve([]),
    prisma.homeTap.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" }, select: { day: true } }),
  ]);

  const counts = new Map<string, HomeCounts>();
  const ayahCounts = new Map<string, Record<number, HomeCounts>>();
  for (const g of grouped) {
    const kind = g.kind as HomeTapKind;
    if (g.ayah === null) {
      const c = counts.get(g.segmentId) ?? { ...EMPTY_COUNTS };
      c[kind] += g._count._all;
      counts.set(g.segmentId, c);
    } else {
      const per = ayahCounts.get(g.segmentId) ?? {};
      per[g.ayah] = per[g.ayah] ?? { ...EMPTY_COUNTS };
      per[g.ayah][kind] += g._count._all;
      ayahCounts.set(g.segmentId, per);
    }
  }
  const lastBySegment = new Map(latest.map((l) => [l.segmentId, l._max.day ? day(l._max.day) : null]));

  const view = (r: (typeof rows)[number]): HomeSegmentView => {
    const targets = { listen: r.targetListen, repeat: r.targetRepeat, recite: r.targetRecite };
    const c = counts.get(r.id) ?? { ...EMPTY_COUNTS };
    return {
      id: r.id,
      surahNumber: r.surahNumber,
      fromAyah: r.fromAyah,
      toAyah: r.toAyah,
      targets,
      counts: c,
      ayahCounts: ayahCounts.get(r.id) ?? {},
      targetsMet: allTargetsMet(c, targets),
      createdAt: day(r.createdAt),
      finishedAt: r.finishedAt ? day(r.finishedAt) : null,
      finishedBy: r.finishedBy,
      lastActivity: lastBySegment.get(r.id) ?? null,
      assignmentId: r.assignmentId,
    };
  };

  return { active: activeRows.map(view), past: pastRows.map(view), lastActivity: lastTap ? day(lastTap.day) : null };
}

/**
 * D3: after a teacher records an official recitation, mark as recited every
 * active home segment of hers that it covers entirely (same surah, whole
 * range), created on or before the recitation's day. Only marks the home
 * record — nothing flows from the home log into the official one.
 */
export async function markSegmentsRecited(
  studentId: string,
  surahNumber: number,
  fromAyah: number,
  toAyah: number,
  occurredAt: Date,
): Promise<number> {
  const endOfDay = new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate(), 23, 59, 59, 999));
  const { count } = await prisma.homeSegment.updateMany({
    where: {
      studentId,
      finishedAt: null,
      surahNumber,
      fromAyah: { gte: fromAyah },
      toAyah: { lte: toAyah },
      createdAt: { lte: endOfDay },
    },
    data: { finishedAt: new Date(), finishedBy: "TEACHER_RECITED" },
  });
  return count;
}
