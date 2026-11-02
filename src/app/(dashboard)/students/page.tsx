import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getStudentSummaries } from "@/lib/students/summary";
import { StudentsList } from "./StudentsList";
import { getCalendarData } from "@/lib/calendar/data";
import { CalendarBanner } from "@/components/calendar/CalendarBanner";
import { studentCodeAccess } from "@/lib/students/student-codes";
import { canAddStudents, canUseOfflineSheet } from "@/lib/students/manage";
import { courseExcuseAllowed, groupSees, staffViewer } from "@/lib/excuse/course-data";

export default async function StudentsPage() {
  const session = await requireSession();

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: {
      groups: { orderBy: { sortOrder: "asc" } },
      // the bulk bar's «+ نقطة» list
      pointsActivities: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, value: true, type: true } },
    },
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

  // «أيام العذر»: the groups whose «معذورة» this viewer sees, and may record (the switch on)
  const excuseViewer = await staffViewer(session);
  const excuseSees = (await courseExcuseAllowed(course.id)) ? visibleGroups.filter((g) => groupSees(excuseViewer, g.id, g.gender)).map((g) => g.id) : [];

  const [students, calendar, archivedCount, codeAccess] = await Promise.all([
    getStudentSummaries(course.id, visibleGroupIds, excuseSees),
    getCalendarData(session),
    session.role === "admin"
      ? prisma.student.count({ where: { courseId: course.id, archivedAt: { not: null } } })
      : Promise.resolve(0),
    studentCodeAccess(session),
  ]);

  const canAdd = canAddStudents(session, course);

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
        canAddStudents={canAdd}
        isSupervisor={session.role === "admin"}
        viewerGender={viewer?.gender ?? null}
        archivedCount={archivedCount}
        canIssueStudentCodes={codeAccess.allowed}
        canUseOfflineSheet={canUseOfflineSheet(session, course)}
        pointsActivities={course.pointsActivities}
        excuseMarks={course.excuseEnabled ? excuseSees : []}
      />
    </>
  );
}
