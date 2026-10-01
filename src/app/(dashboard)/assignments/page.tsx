import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStaffAssignments } from "@/lib/assignments/data";
import { getStaffScope, scopedGroups } from "@/lib/staff-scope";
import { NEUTRAL_GROUP_GENDER } from "@/lib/text/gender";
import { AssignmentsView } from "./AssignmentsView";

// Staff: every assignment reaching her groups, filterable by group, with who
// has and hasn't marked it done. Refused (not just hidden) while the course
// has assignments or student login off.
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await getStaffScope("assignments");
  if (!scope) redirect("/students");
  const params = await searchParams;

  const groups = await scopedGroups(scope);
  const groupFilter = typeof params.group === "string" && groups.some((g) => g.id === params.group) ? params.group : null;

  const [assignments, students, viewer] = await Promise.all([
    getStaffAssignments(scope, { groupId: groupFilter }),
    prisma.student.findMany({
      where: { courseId: scope.courseId, archivedAt: null, groupId: { in: groups.map((g) => g.id) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, groupId: true },
    }),
    scope.session.role === "admin"
      ? prisma.admin.findUnique({ where: { id: scope.session.adminId }, select: { gender: true } })
      : prisma.teacher.findUnique({ where: { id: scope.session.teacherId }, select: { gender: true } }),
  ]);

  const pickGroups = groups.map((g) => ({ ...g, students: students.filter((s) => s.groupId === g.id).map(({ id, name }) => ({ id, name })) }));
  const genders = new Set(groups.map((g) => g.gender));

  return (
    <AssignmentsView
      assignments={assignments}
      groups={pickGroups}
      groupFilter={groupFilter}
      gender={genders.size === 1 ? [...genders][0] : NEUTRAL_GROUP_GENDER}
      homeLogEnabled={scope.homeLogEnabled}
      viewerGender={viewer?.gender ?? null}
    />
  );
}
