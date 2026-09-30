import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { studentNameKey } from "./new-student";

// Editing and archiving students: who may, and the shared checks every
// server action repeats (the UI only hides what these refuse anyway).

type Permission = "ADMIN_ONLY" | "ALL_TEACHERS";

/** Spread into a Student `where` to see only active (not archived) students. */
export const ACTIVE_STUDENT = { archivedAt: null } as const;

export function canEditStudents(session: Session, course: { editStudentsPermission: Permission }): boolean {
  return session.role === "admin" || course.editStudentsPermission === "ALL_TEACHERS";
}

export function canArchiveStudents(session: Session, course: { archiveStudentsPermission: Permission }): boolean {
  return session.role === "admin" || course.archiveStudentsPermission === "ALL_TEACHERS";
}

/**
 * The groups a teacher is limited to — her assigned groups in an
 * ASSIGNED-visibility course — or null for no limit. Same rule as the
 * student list and every per-student action.
 */
export async function teacherGroupLimit(
  session: Session,
  course: { visibilityMode: "ALL_TEACHERS" | "ASSIGNED" },
): Promise<string[] | null> {
  if (session.role !== "teacher" || course.visibilityMode !== "ASSIGNED") return null;
  const assignments = await prisma.teacherGroupAssignment.findMany({
    where: { teacherId: session.teacherId },
    select: { groupId: true },
  });
  return assignments.length > 0 ? assignments.map((a) => a.groupId) : null;
}

/**
 * Whether another student in the course — archived ones included, so a
 * restore can never collide — already has this name (same comparison as the
 * Excel import: ignores tashkeel, tatweel and extra spaces).
 */
export async function studentNameTaken(courseId: string, name: string, exceptStudentId?: string): Promise<boolean> {
  const key = studentNameKey(name);
  const others = await prisma.student.findMany({
    where: { courseId, ...(exceptStudentId ? { id: { not: exceptStudentId } } : {}) },
    select: { name: true },
  });
  return others.some((o) => studentNameKey(o.name) === key);
}

export const duplicateNameMessage = (g: GroupGender) =>
  pickByGroup(g, {
    m: "يوجد في الدورة طالب آخر بهذا الاسم (قد يكون في الأرشيف)",
    f: "توجد في الدورة طالبة أخرى بهذا الاسم (قد تكون في الأرشيف)",
  });
