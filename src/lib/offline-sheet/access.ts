import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { canUseOfflineSheet, teacherGroupLimit } from "@/lib/students/manage";
import type { GroupGender, PersonGender } from "@/lib/text/gender";

// Who may use «التسميع بدون إنترنت», and on which groups: the page, the
// download and both upload steps go through here. The supervisor always,
// every group; a teacher with the permission, only her groups (the same
// rule as the student list).

export interface OfflineAccess {
  courseId: string;
  // the groups she may download/upload, in display order
  groups: { id: string; name: string; gender: GroupGender }[];
  /** null = every group in the course */
  groupLimit: string[] | null;
  viewerGender: PersonGender;
}

/** null when she may not use it at all. */
export async function getOfflineAccess(session: Session): Promise<OfflineAccess | null> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    select: {
      offlineSheetPermission: true,
      visibilityMode: true,
      groups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, gender: true } },
    },
  });
  if (!canUseOfflineSheet(session, course)) return null;
  const groupLimit = await teacherGroupLimit(session, course);
  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });
  return {
    courseId: session.courseId,
    groups: groupLimit ? course.groups.filter((g) => groupLimit.includes(g.id)) : course.groups,
    groupLimit,
    viewerGender: viewer?.gender ?? null,
  };
}
