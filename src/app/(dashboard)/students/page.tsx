import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getStudentSummaries } from "@/lib/students/summary";
import { StudentsList } from "./StudentsList";

export default async function StudentsPage() {
  const session = await requireSession();

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  });

  let visibleGroupIds: string[] | undefined;
  if (session.role === "teacher" && course.visibilityMode === "ASSIGNED") {
    const assignments = await prisma.teacherGroupAssignment.findMany({
      where: { teacherId: session.teacherId },
      select: { groupId: true },
    });
    if (assignments.length > 0) {
      visibleGroupIds = assignments.map((a) => a.groupId);
    }
  }

  const visibleGroups = visibleGroupIds
    ? course.groups.filter((g) => visibleGroupIds!.includes(g.id))
    : course.groups;

  const students = await getStudentSummaries(course.id, visibleGroupIds);

  const canAddStudents = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  return (
    <StudentsList
      groups={visibleGroups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))}
      students={students}
      canAddStudents={canAddStudents}
      canImport={session.role === "admin"}
      viewerGender={viewer?.gender ?? null}
    />
  );
}
