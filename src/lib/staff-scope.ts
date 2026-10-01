import "server-only";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import type { Session } from "@/lib/auth/session";
import { teacherGroupLimit } from "@/lib/students/manage";
import type { GroupGender } from "@/lib/text/gender";

// The shared checks every staff page and action for assignments and the
// daily tracker repeats (the UI only hides what these refuse anyway):
//  - the feature is on, and student login with it;
//  - a teacher works only within her groups (teacherGroupLimit) — every
//    group and every picked student is re-checked against that;
//  - ownership like calendar events: the supervisor edits everything, a
//    teacher only what she created (createdByTeacherId null = supervisor).

export type StudentFeature = "assignments" | "tracker";

export interface StaffScope {
  session: Session;
  courseId: string;
  homeLogEnabled: boolean;
  /** null = every group in the course */
  groupLimit: string[] | null;
}

export async function getStaffScope(feature: StudentFeature): Promise<StaffScope | null> {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: {
      studentLoginEnabled: true,
      assignmentsEnabled: true,
      trackerEnabled: true,
      homeLogEnabled: true,
      visibilityMode: true,
    },
  });
  const on = feature === "assignments" ? course.assignmentsEnabled : course.trackerEnabled;
  if (!course.studentLoginEnabled || !on) return null;
  return {
    session,
    courseId: session.courseId,
    homeLogEnabled: course.homeLogEnabled,
    groupLimit: await teacherGroupLimit(session, course),
  };
}

export const FEATURE_OFF: Record<StudentFeature, string> = {
  assignments: "الواجبات غير مفعّلة في هذه الدورة",
  tracker: "جدول المتابعة غير مفعّل في هذه الدورة",
};

export const NO_GROUP_ACCESS = "ليست لديك صلاحية على هذه المجموعة";

export const inScope = (scope: StaffScope, groupId: string) => scope.groupLimit === null || scope.groupLimit.includes(groupId);

/** Prisma `where` for groups she may work with. */
export const scopedGroupWhere = (scope: StaffScope) => ({
  courseId: scope.courseId,
  ...(scope.groupLimit ? { id: { in: scope.groupLimit } } : {}),
});

export interface ScopeGroup {
  id: string;
  name: string;
  gender: GroupGender;
}

export async function scopedGroups(scope: StaffScope): Promise<ScopeGroup[]> {
  return prisma.group.findMany({
    where: scopedGroupWhere(scope),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, gender: true },
  });
}

/** A group of this course within her scope, or null. */
export async function checkGroup(scope: StaffScope, groupId: unknown): Promise<ScopeGroup | null> {
  const id = String(groupId ?? "");
  if (!id || !inScope(scope, id)) return null;
  return prisma.group.findFirst({ where: { id, courseId: scope.courseId }, select: { id: true, name: true, gender: true } });
}

/**
 * Every picked student: active, of this course, within her scope — or null
 * if any one isn't (the whole pick is refused, never silently trimmed).
 */
export async function checkStudents(
  scope: StaffScope,
  studentIds: unknown,
  max: number,
): Promise<{ id: string; groupId: string }[] | null> {
  if (!Array.isArray(studentIds)) return null;
  const ids = [...new Set(studentIds.map((s) => String(s ?? "")).filter(Boolean))];
  if (ids.length === 0 || ids.length > max) return null;
  const found = await prisma.student.findMany({
    where: { id: { in: ids }, courseId: scope.courseId, archivedAt: null },
    select: { id: true, groupId: true },
  });
  if (found.length !== ids.length || found.some((s) => !inScope(scope, s.groupId))) return null;
  return found;
}

/** One active student of this course within her scope, or null. */
export async function checkStudent(scope: StaffScope, studentId: unknown) {
  const found = await checkStudents(scope, [studentId], 1);
  return found?.[0] ?? null;
}

/** Calendar-style ownership: the supervisor edits all; a teacher only her own. */
export function ownsRecord(scope: StaffScope, createdByTeacherId: string | null): boolean {
  return scope.session.role === "admin" || createdByTeacherId === scope.session.teacherId;
}

/** createdByTeacherId for a new record: null for the supervisor. */
export const creatorId = (scope: StaffScope) => (scope.session.role === "teacher" ? scope.session.teacherId : null);
