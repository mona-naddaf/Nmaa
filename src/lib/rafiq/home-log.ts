import "server-only";
import { prisma } from "@/lib/db";
import { buildHomeLogView, type HomeLogView, type HomeSegmentRow } from "@/lib/home-log/data";
import type { HomeTargets } from "@/lib/home-log/rules";

// «حفظي في البيت» for «رفيق الحفظ»: her passages and taps, built into the
// same view as a course student's (buildHomeLogView), so the shared practice
// screen, cards and progress work unchanged. Every query is scoped by her id.

export async function getRafiqTargets(userId: string): Promise<HomeTargets> {
  const u = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: userId },
    select: { homeTargetListen: true, homeTargetRepeat: true, homeTargetRecite: true },
  });
  return { listen: u.homeTargetListen, repeat: u.homeTargetRepeat, recite: u.homeTargetRecite };
}

const toRow = (s: {
  id: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  targetListen: number;
  targetRepeat: number;
  targetRecite: number;
  createdAt: Date;
  finishedAt: Date | null;
  finishedBySession: boolean;
}): HomeSegmentRow => ({
  ...s,
  // the shared cards label "covered by a recorded session" as TEACHER_RECITED
  finishedBy: s.finishedAt ? (s.finishedBySession ? "TEACHER_RECITED" : "STUDENT") : null,
  assignmentId: null,
});

export async function getRafiqHomeLog(userId: string, { pastLimit = 30 }: { pastLimit?: number } = {}): Promise<HomeLogView> {
  const [activeRows, pastRows] = await Promise.all([
    prisma.rafiqHomeSegment.findMany({ where: { userId, finishedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.rafiqHomeSegment.findMany({ where: { userId, finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, take: pastLimit }),
  ]);
  const ids = [...activeRows, ...pastRows].map((r) => r.id);
  const [grouped, latest, lastTap] = await Promise.all([
    ids.length
      ? prisma.rafiqHomeTap.groupBy({ by: ["segmentId", "ayah", "kind"], where: { segmentId: { in: ids } }, _count: { _all: true } })
      : Promise.resolve([]),
    ids.length
      ? prisma.rafiqHomeTap.groupBy({ by: ["segmentId"], where: { segmentId: { in: ids } }, _max: { day: true } })
      : Promise.resolve([]),
    prisma.rafiqHomeTap.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { day: true } }),
  ]);
  return buildHomeLogView({
    activeRows: activeRows.map(toRow),
    pastRows: pastRows.map(toRow),
    grouped,
    latest,
    lastTapDay: lastTap?.day ?? null,
  });
}

/**
 * After she saves a NEW session: every active passage of hers it covers
 * entirely (same surah, whole range), started on or before the session's
 * day, is marked done (as a course does after a teacher's recitation).
 */
export async function finishCoveredSegments(userId: string, surahNumber: number, fromAyah: number, toAyah: number, day: string) {
  await prisma.rafiqHomeSegment.updateMany({
    where: {
      userId,
      finishedAt: null,
      surahNumber,
      fromAyah: { gte: fromAyah },
      toAyah: { lte: toAyah },
      createdAt: { lte: new Date(`${day}T23:59:59.999Z`) },
    },
    data: { finishedAt: new Date(), finishedBySession: true },
  });
}
