import "server-only";
import { prisma } from "@/lib/db";
import { deriveFurthestPosition } from "@/lib/recitation/logic";
import { SURAH_NAME, AYAH_COUNT } from "@/lib/quran-data";
import { attendanceStatusForDay, todayDateOnly, type AttendanceStatus } from "@/lib/attendance";

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
}

export async function getStudentSummaries(courseId: string, groupIds?: string[]): Promise<StudentSummary[]> {
  const students = await prisma.student.findMany({
    where: { courseId, ...(groupIds ? { groupId: { in: groupIds } } : {}) },
    include: { planItems: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });
  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  const today = todayDateOnly();
  const [sessions, pointsLogs, attendanceLogs] = await Promise.all([
    prisma.recitationSession.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, surahNumber: true, toAyah: true, pagesCalculated: true, mode: true },
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

    const furthest = deriveFurthestPosition(
      plan,
      studentSessions.map((s) => ({ surahNumber: s.surahNumber, toAyah: s.toAyah })),
    );

    const cumPages = studentSessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
    const onlineCount = studentSessions.filter((s) => s.mode === "ONLINE").length;

    const lastPositionText = furthest
      ? `${SURAH_NAME[furthest.surahNumber]} — آية ${furthest.ayah} من ${AYAH_COUNT[furthest.surahNumber]}`
      : plan.length > 0
        ? `لم تبدأ بعد — أول سورة في الخطة: ${SURAH_NAME[plan[0]]}`
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
    };
  });
}
