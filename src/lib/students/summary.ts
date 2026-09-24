import "server-only";
import { prisma } from "@/lib/db";
import { deriveFurthestPosition } from "@/lib/recitation/logic";
import { SURAH_NAME, AYAH_COUNT } from "@/lib/quran-data";
import { attendanceStatusForDay, todayDateOnly, type AttendanceStatus } from "@/lib/attendance";
import { pickByGroup } from "@/lib/text/gender";
import { computeOverdueSurahs } from "@/lib/students/review";

export interface StudentSummary {
  id: string;
  name: string;
  age: number;
  groupId: string;
  attendance: AttendanceStatus;
  cumPages: number;
  cumPoints: number;
  onlineCount: number;
  lastPositionText: string;
  // completed surahs past the course review window (0 when reminders are off)
  overdueReviewCount: number;
}

export async function getStudentSummaries(courseId: string, groupIds?: string[]): Promise<StudentSummary[]> {
  const students = await prisma.student.findMany({
    where: { courseId, ...(groupIds ? { groupId: { in: groupIds } } : {}) },
    include: { planItems: { orderBy: { position: "asc" } }, group: { select: { gender: true } } },
    orderBy: { name: "asc" },
  });
  if (students.length === 0) return [];

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { reviewReminderDays: true } });
  const reviewDays = course?.reviewReminderDays ?? null;

  const studentIds = students.map((s) => s.id);

  const today = todayDateOnly();
  const [sessions, pointsLogs, attendanceLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        surahNumber: true,
        fromAyah: true,
        toAyah: true,
        pagesCalculated: true,
        mode: true,
        type: true,
        occurredAt: true,
      },
    }),
    prisma.pointsLog.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, valueAtTime: true, typeAtTime: true },
    }),
    prisma.attendanceLog.findMany({
      where: { studentId: { in: studentIds }, day: today },
      select: { studentId: true, day: true, status: true },
    }),
  ]);

  const attendanceByStudent = new Map<string, { day: Date; status: AttendanceStatus }[]>();
  for (const a of attendanceLogs) {
    const arr = attendanceByStudent.get(a.studentId) ?? [];
    arr.push(a);
    attendanceByStudent.set(a.studentId, arr);
  }

  const sessionsByStudent = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const arr = sessionsByStudent.get(s.studentId) ?? [];
    arr.push(s);
    sessionsByStudent.set(s.studentId, arr);
  }

  const pointsByStudent = new Map<string, number>();
  for (const p of pointsLogs) {
    const delta = p.typeAtTime === "ADD" ? p.valueAtTime : -p.valueAtTime;
    pointsByStudent.set(p.studentId, (pointsByStudent.get(p.studentId) ?? 0) + delta);
  }

  return students.map((student) => {
    const plan = student.planItems.map((pi) => pi.surahNumber);
    const studentSessions = sessionsByStudent.get(student.id) ?? [];

    const furthest = deriveFurthestPosition(plan, studentSessions);

    const cumPages = studentSessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
    const onlineCount = studentSessions.filter((s) => s.mode === "ONLINE").length;

    const lastPositionText = furthest
      ? `${SURAH_NAME[furthest.surahNumber]} — آية ${furthest.ayah} من ${AYAH_COUNT[furthest.surahNumber]}`
      : plan.length > 0
        ? `لم ${pickByGroup(student.group.gender, { m: "يبدأ", f: "تبدأ" })} بعد — أول سورة في الخطة: ${SURAH_NAME[plan[0]]}`
        : "لا توجد خطة بعد";

    return {
      id: student.id,
      name: student.name,
      age: student.age,
      groupId: student.groupId,
      attendance: attendanceStatusForDay(attendanceByStudent.get(student.id) ?? [], today),
      cumPages: Math.round(cumPages * 1000) / 1000,
      cumPoints: pointsByStudent.get(student.id) ?? 0,
      onlineCount,
      lastPositionText,
      overdueReviewCount: computeOverdueSurahs(studentSessions, reviewDays, today).length,
    };
  });
}
