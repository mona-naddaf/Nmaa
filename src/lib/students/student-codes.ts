import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { studentCodeStatus } from "@/lib/auth/student-code";
import { teacherGroupLimit } from "./manage";

// Who may see, issue, regenerate and revoke student codes, and for which
// groups. Every page and server action touching student codes goes through
// this — the UI only hides what it refuses anyway.
export type StudentCodeAccess =
  | { allowed: false }
  // groupIds null = every group (supervisor, or a teacher with no assignments)
  | { allowed: true; groupIds: string[] | null };

export async function studentCodeAccess(session: Session): Promise<StudentCodeAccess> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: { studentLoginEnabled: true, issueStudentCodesPermission: true, visibilityMode: true },
  });
  if (!course.studentLoginEnabled) return { allowed: false };
  if (session.role === "admin") return { allowed: true, groupIds: null };
  if (course.issueStudentCodesPermission !== "ALL_TEACHERS") return { allowed: false };
  return { allowed: true, groupIds: await teacherGroupLimit(session, course) };
}

export function inScope(access: StudentCodeAccess, groupId: string): boolean {
  return access.allowed && (access.groupIds === null || access.groupIds.includes(groupId));
}

export interface StudentCodeRow {
  id: string;
  name: string;
  groupName: string;
  code: string | null;
  status: "active" | "revoked" | "none";
}

/** Active students in scope with their code status, by group order then name. */
export async function getStudentCodeRows(courseId: string, groupIds: string[] | null): Promise<StudentCodeRow[]> {
  const groups = await prisma.group.findMany({
    where: { courseId, ...(groupIds ? { id: { in: groupIds } } : {}) },
    orderBy: { sortOrder: "asc" },
    select: {
      name: true,
      students: {
        where: { archivedAt: null },
        select: { id: true, name: true, studentCode: true, studentCodeVersion: true },
      },
    },
  });
  return groups.flatMap((g) =>
    [...g.students]
      .sort((a, b) => a.name.localeCompare(b.name, "ar"))
      .map((s) => ({ id: s.id, name: s.name, groupName: g.name, code: s.studentCode, status: studentCodeStatus(s) })),
  );
}
