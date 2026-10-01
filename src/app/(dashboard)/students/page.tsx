import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getStudentSummaries } from "@/lib/students/summary";
import { StudentsList } from "./StudentsList";
import { getCalendarData } from "@/lib/calendar/data";
import { CalendarBanner } from "@/components/calendar/CalendarBanner";
import { studentCodeAccess } from "@/lib/students/student-codes";

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

  const [students, calendar, archivedCount, codeAccess] = await Promise.all([
    getStudentSummaries(course.id, visibleGroupIds),
    getCalendarData(session),
    session.role === "admin"
      ? prisma.student.count({ where: { courseId: course.id, archivedAt: { not: null } } })
      : Promise.resolve(0),
    studentCodeAccess(session),
  ]);

  const canAddStudents = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  return (
    <>
      {calendar?.bannerEnabled && (
        <CalendarBanner
          enabledOccasions={calendar.enabledOccasions}
          adjustments={calendar.adjustments}
          events={calendar.events}
        />
      )}
      <StudentsList
        groups={visibleGroups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))}
        students={students}
        canAddStudents={canAddStudents}
        isSupervisor={session.role === "admin"}
        viewerGender={viewer?.gender ?? null}
        archivedCount={archivedCount}
        canIssueStudentCodes={codeAccess.allowed}
      />
    </>
  );
}
