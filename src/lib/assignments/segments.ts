import "server-only";
import { prisma } from "@/lib/db";
import { assignmentsForStudentWhere } from "./data";

// QURAN assignments ↔ «واجب» segments in the home log (D4). Like every home
// segment, these never touch RecitationSession: the official position only
// moves with a teacher-recorded recitation.
//
// "Touched" = she has practised it (any tap) or it's already finished.
// Touched segments are hers: they keep their range when the assignment is
// edited, and stay (unlinked) when it's deleted or no longer targets her.
// Untouched ones simply follow the assignment.
//
// Only runs while the course has the home log on (D3); with it off no
// segments are created, and existing ones are left alone.

const touched = { OR: [{ taps: { some: {} } }, { finishedAt: { not: null } }] };
const untouched = { taps: { none: {} }, finishedAt: null };

/** Per-student targets (her own, else the course default), for many students at once. */
async function targetsFor(studentIds: string[]) {
  const rows = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      homeTargetListen: true,
      homeTargetRepeat: true,
      homeTargetRecite: true,
      course: { select: { homeTargetListen: true, homeTargetRepeat: true, homeTargetRecite: true } },
    },
  });
  return rows.map((s) => ({
    studentId: s.id,
    targetListen: s.homeTargetListen ?? s.course.homeTargetListen,
    targetRepeat: s.homeTargetRepeat ?? s.course.homeTargetRepeat,
    targetRecite: s.homeTargetRecite ?? s.course.homeTargetRecite,
  }));
}

/** Students an assignment targets right now (active only). */
async function currentTargets(a: { id: string; targetGroupId: string | null }): Promise<string[]> {
  const rows = a.targetGroupId
    ? await prisma.student.findMany({ where: { groupId: a.targetGroupId, archivedAt: null }, select: { id: true } })
    : await prisma.student.findMany({ where: { archivedAt: null, assignmentTargets: { some: { assignmentId: a.id } } }, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * After an assignment is created or edited: every current target gets a
 * segment; untouched ones follow a changed range; students no longer
 * targeted lose untouched segments and keep touched ones, unlinked.
 */
export async function syncAssignmentSegments(assignmentId: string): Promise<void> {
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, type: true, targetGroupId: true, surahNumber: true, fromAyah: true, toAyah: true, course: { select: { homeLogEnabled: true } } },
  });
  if (!a) return;
  // no longer a QURAN assignment: let go of its segments, home log on or off
  if (a.type !== "QURAN" || a.surahNumber === null || a.fromAyah === null || a.toAyah === null) {
    await detachAssignmentSegments(a.id);
    return;
  }
  if (!a.course.homeLogEnabled) return;
  const range = { surahNumber: a.surahNumber, fromAyah: a.fromAyah, toAyah: a.toAyah };
  const targetIds = await currentTargets(a);

  await prisma.$transaction([
    // no longer targeted
    prisma.homeSegment.deleteMany({ where: { assignmentId: a.id, studentId: { notIn: targetIds }, ...untouched } }),
    prisma.homeSegment.updateMany({ where: { assignmentId: a.id, studentId: { notIn: targetIds }, ...touched }, data: { assignmentId: null } }),
    // untouched ones follow the (possibly edited) range
    prisma.homeSegment.updateMany({ where: { assignmentId: a.id, ...untouched }, data: range }),
  ]);

  const have = await prisma.homeSegment.findMany({ where: { assignmentId: a.id }, select: { studentId: true } });
  const haveSet = new Set(have.map((h) => h.studentId));
  const missing = targetIds.filter((id) => !haveSet.has(id));
  if (missing.length) {
    const targets = await targetsFor(missing);
    // skipDuplicates: the (assignmentId, studentId) unique index makes a
    // concurrent sync harmless
    await prisma.homeSegment.createMany({ data: targets.map((t) => ({ ...t, ...range, assignmentId: a.id })), skipDuplicates: true });
  }
}

/** Before deleting an assignment: untouched segments go; touched ones stay hers (FK SetNull unlinks them). */
export async function detachAssignmentSegments(assignmentId: string): Promise<void> {
  await prisma.$transaction([
    prisma.homeSegment.deleteMany({ where: { assignmentId, ...untouched } }),
    prisma.homeSegment.updateMany({ where: { assignmentId }, data: { assignmentId: null } }),
  ]);
}

/**
 * For one student, when she opens her assignments or home log: creates the
 * segments of QURAN assignments that reach her through her group but were
 * set before she joined it (or before the home log was on), and lets go of
 * segments whose assignment no longer reaches her (she moved group).
 * Cheap when there's nothing to do: two queries.
 */
export async function syncStudentAssignmentSegments(studentId: string): Promise<void> {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, courseId: true, groupId: true, archivedAt: true, course: { select: { homeLogEnabled: true, assignmentsEnabled: true } } },
  });
  if (!s || s.archivedAt || !s.course.homeLogEnabled || !s.course.assignmentsEnabled) return;

  const stale = { studentId, assignment: { NOT: assignmentsForStudentWhere(s) } };
  const strays = await prisma.homeSegment.count({ where: stale });
  if (strays > 0) {
    await prisma.$transaction([
      prisma.homeSegment.deleteMany({ where: { ...stale, ...untouched } }),
      prisma.homeSegment.updateMany({ where: stale, data: { assignmentId: null } }),
    ]);
  }

  const missing = await prisma.assignment.findMany({
    where: {
      ...assignmentsForStudentWhere(s),
      type: "QURAN",
      surahNumber: { not: null },
      homeSegments: { none: { studentId } },
    },
    select: { id: true, surahNumber: true, fromAyah: true, toAyah: true },
  });
  if (missing.length === 0) return;
  const [t] = await targetsFor([studentId]);
  await prisma.homeSegment.createMany({
    data: missing.map((a) => ({ ...t, assignmentId: a.id, surahNumber: a.surahNumber!, fromAyah: a.fromAyah!, toAyah: a.toAyah! })),
    skipDuplicates: true,
  });
}
