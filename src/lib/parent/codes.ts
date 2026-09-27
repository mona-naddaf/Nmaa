import "server-only";
import { prisma } from "@/lib/db";
import { parentCodeStatus } from "@/lib/auth/parent-code";
import type { GroupGender } from "@/lib/text/gender";

export interface ParentCodeRow {
  id: string;
  name: string;
  groupName: string;
  code: string | null;
  status: "active" | "revoked" | "none";
}

/**
 * Every student in the course with their parent-code status, sorted by group
 * (in the course's group order) then name. Supervisor-only data: callers
 * must have checked requireAdmin.
 */
export async function getParentCodeRows(courseId: string): Promise<{ rows: ParentCodeRow[]; courseGender: GroupGender }> {
  const groups = await prisma.group.findMany({
    where: { courseId },
    orderBy: { sortOrder: "asc" },
    select: {
      name: true,
      gender: true,
      students: { select: { id: true, name: true, parentCode: true, parentCodeVersion: true } },
    },
  });

  const rows = groups.flatMap((g) =>
    [...g.students]
      .sort((a, b) => a.name.localeCompare(b.name, "ar"))
      .map((s) => ({ id: s.id, name: s.name, groupName: g.name, code: s.parentCode, status: parentCodeStatus(s) })),
  );

  // course-wide wording: girls/boys only when every group agrees, else neutral
  const genders = new Set(groups.map((g) => g.gender));
  const courseGender: GroupGender = genders.size === 1 ? [...genders][0] : "MIXED";
  return { rows, courseGender };
}
