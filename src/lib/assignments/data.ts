import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { EMPTY_COUNTS, allTargetsMet, type HomeCounts, type HomeTapKind, type HomeTargets } from "@/lib/home-log/rules";
import { inScope, ownsRecord, type StaffScope } from "@/lib/staff-scope";
import { NEUTRAL_GROUP_GENDER, type GroupGender } from "@/lib/text/gender";
import type { AssignmentType } from "./rules";

// The only place assignments are read for display (student, staff and
// parent views all use this). Who an assignment targets is always worked out
// live: a whole-group assignment covers the group's current active students
// (later additions included, archived ones out); a picked one covers its
// picked students who are still active.

export interface AssignmentRange {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
}

export interface AssignmentSegment {
  id: string;
  counts: HomeCounts;
  targets: HomeTargets;
  targetsMet: boolean;
  finished: boolean;
}

export interface StudentAssignment {
  id: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  dueDate: string | null; // YYYY-MM-DD
  range: AssignmentRange | null;
  createdAt: string; // YYYY-MM-DD
  done: boolean;
  doneAt: string | null; // ISO timestamp — shown as her local day by the browser
  // QURAN only: her «واجب» segment in the home log, if it exists
  segment: AssignmentSegment | null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

const rangeOf = (a: { surahNumber: number | null; fromAyah: number | null; toAyah: number | null }): AssignmentRange | null =>
  a.surahNumber !== null && a.fromAyah !== null && a.toAyah !== null
    ? { surahNumber: a.surahNumber, fromAyah: a.fromAyah, toAyah: a.toAyah }
    : null;

/** Prisma `where` for every assignment that targets this student now. */
export const assignmentsForStudentWhere = (s: { id: string; courseId: string; groupId: string }): Prisma.AssignmentWhereInput => ({
  courseId: s.courseId,
  OR: [{ targetGroupId: s.groupId }, { students: { some: { studentId: s.id } } }],
});

/** Her assignments: open first (soonest due first), then done (latest first). */
export async function getStudentAssignments(studentId: string): Promise<StudentAssignment[]> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, courseId: true, groupId: true } });
  const rows = await prisma.assignment.findMany({
    where: assignmentsForStudentWhere(student),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      dueDate: true,
      surahNumber: true,
      fromAyah: true,
      toAyah: true,
      createdAt: true,
      completions: { where: { studentId }, select: { doneAt: true } },
      homeSegments: {
        where: { studentId },
        select: { id: true, targetListen: true, targetRepeat: true, targetRecite: true, finishedAt: true },
      },
    },
  });

  const segmentIds = rows.flatMap((r) => r.homeSegments.map((s) => s.id));
  const grouped = segmentIds.length
    ? await prisma.homeTap.groupBy({ by: ["segmentId", "kind"], where: { segmentId: { in: segmentIds }, ayah: null }, _count: { _all: true } })
    : [];
  const counts = new Map<string, HomeCounts>();
  for (const g of grouped) {
    const c = counts.get(g.segmentId) ?? { ...EMPTY_COUNTS };
    c[g.kind as HomeTapKind] += g._count._all;
    counts.set(g.segmentId, c);
  }

  const list = rows.map((r): StudentAssignment => {
    const seg = r.homeSegments[0];
    let segment: AssignmentSegment | null = null;
    if (seg) {
      const targets = { listen: seg.targetListen, repeat: seg.targetRepeat, recite: seg.targetRecite };
      const c = counts.get(seg.id) ?? { ...EMPTY_COUNTS };
      segment = { id: seg.id, counts: c, targets, targetsMet: allTargetsMet(c, targets), finished: seg.finishedAt !== null };
    }
    const completion = r.completions[0];
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      dueDate: r.dueDate ? day(r.dueDate) : null,
      range: rangeOf(r),
      createdAt: day(r.createdAt),
      done: !!completion,
      doneAt: completion ? completion.doneAt.toISOString() : null,
      segment,
    };
  });

  const open = list.filter((a) => !a.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || b.createdAt.localeCompare(a.createdAt));
  const done = list.filter((a) => a.done).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));
  return [...open, ...done];
}

// ---------- Staff ----------

export interface StaffAssignmentStudent {
  id: string;
  name: string;
  groupName: string;
  done: boolean;
}

export interface StaffAssignment {
  id: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  dueDate: string | null;
  range: AssignmentRange | null;
  createdAt: string;
  target: { kind: "GROUP"; groupId: string; groupName: string } | { kind: "STUDENTS" };
  // wording for its students: the group's gender, or the picked students'
  // shared gender (neutral when they're from groups of different genders)
  gender: GroupGender;
  creatorName: string | null; // null = the supervisor
  canEdit: boolean;
  // its target students that this viewer may see (her groups only)
  students: StaffAssignmentStudent[];
}

/**
 * Assignments with at least one target in her scope, newest first;
 * groupId narrows to those targeting that group (whole, or any picked
 * student in it). studentId narrows to those targeting that student.
 */
export async function getStaffAssignments(
  scope: StaffScope,
  filter: { groupId?: string | null; studentId?: string } = {},
): Promise<StaffAssignment[]> {
  const limit = scope.groupLimit;
  const groupIn = filter.groupId ? [filter.groupId] : limit;
  const where: Prisma.AssignmentWhereInput = { courseId: scope.courseId };
  if (filter.studentId) {
    const s = await prisma.student.findFirst({ where: { id: filter.studentId, courseId: scope.courseId }, select: { id: true, groupId: true } });
    if (!s || !inScope(scope, s.groupId)) return [];
    where.OR = [{ targetGroupId: s.groupId }, { students: { some: { studentId: s.id } } }];
  } else if (groupIn) {
    where.OR = [
      { targetGroupId: { in: groupIn } },
      { students: { some: { student: { groupId: { in: groupIn }, archivedAt: null } } } },
    ];
  }

  const rows = await prisma.assignment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      dueDate: true,
      surahNumber: true,
      fromAyah: true,
      toAyah: true,
      createdAt: true,
      createdByTeacherId: true,
      createdByTeacher: { select: { name: true } },
      targetGroup: { select: { id: true, name: true, gender: true } },
      students: {
        where: { student: { archivedAt: null } },
        select: { student: { select: { id: true, name: true, groupId: true, group: { select: { name: true, gender: true } } } } },
      },
      completions: { select: { studentId: true } },
    },
  });

  // active students of every whole-group target, in one query
  const groupIds = [...new Set(rows.map((r) => r.targetGroup?.id).filter((g): g is string => !!g))];
  const groupStudents = groupIds.length
    ? await prisma.student.findMany({
        where: { groupId: { in: groupIds }, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, groupId: true },
      })
    : [];
  const byGroup = new Map<string, { id: string; name: string }[]>();
  for (const s of groupStudents) byGroup.set(s.groupId, [...(byGroup.get(s.groupId) ?? []), s]);

  return rows.map((r): StaffAssignment => {
    const done = new Set(r.completions.map((c) => c.studentId));
    let students: StaffAssignmentStudent[];
    let gender: GroupGender;
    if (r.targetGroup) {
      const g = r.targetGroup;
      students = inScope(scope, g.id) ? (byGroup.get(g.id) ?? []).map((s) => ({ id: s.id, name: s.name, groupName: g.name, done: done.has(s.id) })) : [];
      gender = g.gender;
    } else {
      const visible = r.students.map((x) => x.student).filter((s) => inScope(scope, s.groupId));
      students = visible
        .map((s) => ({ id: s.id, name: s.name, groupName: s.group.name, done: done.has(s.id) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));
      const genders = new Set(visible.map((s) => s.group.gender));
      gender = genders.size === 1 ? [...genders][0] : NEUTRAL_GROUP_GENDER;
    }
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      dueDate: r.dueDate ? day(r.dueDate) : null,
      range: rangeOf(r),
      createdAt: day(r.createdAt),
      target: r.targetGroup ? { kind: "GROUP", groupId: r.targetGroup.id, groupName: r.targetGroup.name } : { kind: "STUDENTS" },
      gender,
      creatorName: r.createdByTeacherId ? (r.createdByTeacher?.name ?? null) : null,
      canEdit: ownsRecord(scope, r.createdByTeacherId),
      students,
    };
  });
}
