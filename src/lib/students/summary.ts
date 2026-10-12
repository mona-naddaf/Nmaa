import "server-only";
import { prisma } from "@/lib/db";
import { deriveCurrentPosition, deriveReach } from "@/lib/recitation/logic";
import { PLAN_INCLUDE, forPlanPosition, secondTrackView, studentPlan } from "./plan";
import { SURAH_NAME, AYAH_COUNT } from "@/lib/quran-data";
import { attendanceDay, attendanceStatusForDay, todayDateOnly, type AttendanceStatus } from "@/lib/attendance";
import { pickByGroup } from "@/lib/text/gender";
import { computeOverdueSurahs } from "@/lib/students/review";
import { computeStreaks } from "@/lib/students/streak-data";
import { entryCount } from "@/lib/recitation/combined";

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
  // her second track's position, when she has one
  secondPositionText: string | null;
  // completed surahs past the course review window (0 when reminders are off)
  overdueReviewCount: number;
  // consecutive qualifying weeks (null when the course has streaks off)
  streak: number | null;
}

export async function getStudentSummaries(courseId: string, groupIds?: string[]): Promise<StudentSummary[]> {
  const students = await prisma.student.findMany({
    where: { courseId, archivedAt: null, ...(groupIds ? { groupId: { in: groupIds } } : {}) },
    include: { ...PLAN_INCLUDE, group: { select: { gender: true } } },
    orderBy: { name: "asc" },
  });
  if (students.length === 0) return [];

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { reviewReminderDays: true, streakMode: true } });
  const reviewDays = course?.reviewReminderDays ?? null;
  // the list always shows whole groups, so each group's full membership is here
  const streaks = course?.streakMode ? await computeStreaks(course.streakMode, students) : null;

  const studentIds = students.map((s) => s.id);

  const today = todayDateOnly();
  // today's attendance status: Riyadh's day (lib/attendance.ts)
  const attendanceToday = attendanceDay();
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
        situation: true,
        reason: true,
        occurredAt: true,
        createdAt: true,
        comboId: true,
        trackId: true,
      },
    }),
    prisma.pointsLog.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, valueAtTime: true, typeAtTime: true },
    }),
    prisma.attendanceLog.findMany({
      where: { studentId: { in: studentIds }, day: attendanceToday },
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
    const sp = studentPlan(student);
    const { plan, planChangedAt } = sp;
    const studentSessions = sessionsByStudent.get(student.id) ?? [];
    const second = secondTrackView(sp, studentSessions, student.group.gender);

    const position = deriveCurrentPosition(plan, deriveReach(plan, forPlanPosition(studentSessions, planChangedAt)));

    const cumPages = studentSessions.reduce((sum, s) => sum + Number(s.pagesCalculated), 0);
    // a combined entry (one recitation saved as parts) counts once
    const onlineCount = entryCount(studentSessions.filter((s) => s.mode === "ONLINE"));

    const lastPositionText = position
      ? `${SURAH_NAME[position.surahNumber]} — آية ${position.ayah} من ${AYAH_COUNT[position.surahNumber]}`
      : plan.length > 0
        ? `لم ${pickByGroup(student.group.gender, { m: "يبدأ", f: "تبدأ" })} بعد — أول سورة في الخطة: ${SURAH_NAME[plan[0]]}`
        : "لا توجد خطة بعد";

    return {
      id: student.id,
      name: student.name,
      age: student.age,
      groupId: student.groupId,
      attendance: attendanceStatusForDay(attendanceByStudent.get(student.id) ?? [], attendanceToday),
      cumPages: Math.round(cumPages * 1000) / 1000,
      cumPoints: pointsByStudent.get(student.id) ?? 0,
      onlineCount,
      lastPositionText,
      // worded like lastPositionText («آية … من …»)
      secondPositionText: second
        ? second.progress?.position && !second.done
          ? `${SURAH_NAME[second.progress.position.surahNumber]} — آية ${second.progress.position.ayah} من ${AYAH_COUNT[second.progress.position.surahNumber]}`
          : second.positionText
        : null,
      overdueReviewCount: computeOverdueSurahs(studentSessions, reviewDays, today).length,
      streak: streaks ? (streaks.get(student.id) ?? 0) : null,
    };
  });
}
