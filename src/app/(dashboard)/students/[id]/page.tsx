import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { deriveFurthestPosition } from "@/lib/recitation/logic";
import { effectiveAttendance } from "@/lib/attendance";
import { TOTAL_PAGES } from "@/lib/quran-data";
import { DetailView } from "./DetailView";

export default async function StudentDetailPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const session = await requireSession();

  const student = await prisma.student.findFirst({
    where: { id, courseId: session.courseId },
    include: { planItems: { orderBy: { position: "asc" } } },
  });
  if (!student) notFound();

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

  const [sessions, pointsLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId: student.id },
      include: { teacher: { select: { name: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    }),
    prisma.pointsLog.findMany({ where: { studentId: student.id } }),
  ]);

  const plan = student.planItems.map((pi) => pi.surahNumber);
  const furthest = deriveFurthestPosition(
    plan,
    sessions.map((s) => ({ surahNumber: s.surahNumber, toAyah: s.toAyah })),
  );

  const cumPages = sessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
  const onlineCount = sessions.filter((s) => s.mode === "ONLINE").length;
  const cumPoints = pointsLogs.reduce((sum, p) => sum + (p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime), 0);

  return (
    <DetailView
      student={{
        id: student.id,
        name: student.name,
        age: student.age,
        attendance: effectiveAttendance(student.attendanceStatus, student.attendanceDay),
      }}
      plan={plan}
      furthest={furthest}
      cumPages={Math.round(cumPages * 1000) / 1000}
      cumPoints={cumPoints}
      onlineCount={onlineCount}
      totalPages={TOTAL_PAGES}
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
        teacherName: s.teacher.name,
        notes: s.notes,
        reason: s.reason,
      }))}
    />
  );
}
