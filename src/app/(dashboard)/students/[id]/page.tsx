import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { deriveFurthestPosition } from "@/lib/recitation/logic";
import { attendanceStatusForDay, todayDateOnly } from "@/lib/attendance";
import { TOTAL_PAGES } from "@/lib/quran-data";
import { buildCoverage, computeProgressBars, coverageToRanges, coveredQuranPages } from "@/lib/students/progress";
import { computeOverdueSurahs } from "@/lib/students/review";
import { DetailView } from "./DetailView";
import { ParentCodeCard } from "./ParentCodeCard";

export default async function StudentDetailPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const session = await requireSession();

  const student = await prisma.student.findFirst({
    where: { id, courseId: session.courseId },
    include: { planItems: { orderBy: { position: "asc" } }, group: { select: { gender: true } } },
  });
  if (!student) notFound();

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { pointsActivities: { orderBy: { sortOrder: "asc" } } },
  });

  if (session.role === "teacher" && course.visibilityMode === "ASSIGNED") {
    const assignments = await prisma.teacherGroupAssignment.findMany({ where: { teacherId: session.teacherId } });
    if (assignments.length > 0 && !assignments.some((a) => a.groupId === student.groupId)) {
      redirect("/students");
    }
  }

  const today = todayDateOnly();
  const [sessions, pointsLogs, todayAttendance] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId: student.id },
      include: { teacher: { select: { name: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    }),
    prisma.pointsLog.findMany({ where: { studentId: student.id } }),
    prisma.attendanceLog.findMany({ where: { studentId: student.id, day: today } }),
  ]);

  const plan = student.planItems.map((pi) => pi.surahNumber);
  const furthest = deriveFurthestPosition(plan, sessions);

  const cumPages = sessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
  const onlineCount = sessions.filter((s) => s.mode === "ONLINE").length;
  const coverage = buildCoverage(sessions);
  const progressBars = computeProgressBars({ settings: course, plan, furthest, coverage });
  const overdueSurahs = computeOverdueSurahs(sessions, course.reviewReminderDays, today);
  const cumPoints = pointsLogs.reduce((sum, p) => sum + (p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime), 0);

  return (
    <>
      <DetailView
        student={{
          id: student.id,
          name: student.name,
          age: student.age,
          attendance: attendanceStatusForDay(todayAttendance, today),
        }}
        groupGender={student.group.gender}
        viewerGender={viewer?.gender ?? null}
        plan={plan}
        furthest={furthest}
        cumPages={Math.round(cumPages * 1000) / 1000}
        cumPoints={cumPoints}
        onlineCount={onlineCount}
        coveredPages={coveredQuranPages(coverage)}
        totalPages={TOTAL_PAGES}
        progressBars={progressBars}
        memorizedRanges={coverageToRanges(coverage)}
        overdueSurahs={overdueSurahs}
        reviewReminderDays={course.reviewReminderDays}
        onlineRecitationEnabled={course.onlineRecitationEnabled}
        pointsActivities={course.pointsActivities.map((a) => ({
          id: a.id,
          name: a.name,
          value: a.value,
          type: a.type,
        }))}
        pointsLogs={pointsLogs.map((p) => ({
          activityId: p.activityId,
          date: p.day.toISOString().slice(0, 10),
          value: p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime,
        }))}
        history={sessions.map((s) => ({
          id: s.id,
          date: s.occurredAt.toISOString().slice(0, 10),
          source: s.source,
          surahNumber: s.surahNumber,
          fromAyah: s.fromAyah,
          toAyah: s.toAyah,
          quality: s.quality,
          mode: s.mode,
          type: s.type,
          teacherName: s.teacher.name,
          notes: s.notes,
          reason: s.reason,
        }))}
      />
      {/* supervisor only: the code is never sent to a teacher's browser */}
      {session.role === "admin" && (
        <ParentCodeCard
          studentId={student.id}
          groupGender={student.group.gender}
          initialCode={student.parentCode}
          initialCreatedAt={student.parentCodeCreatedAt?.toISOString() ?? null}
        />
      )}
    </>
  );
}
