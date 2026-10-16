import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  STUDENT_COOKIE_NAME,
  STUDENT_COOKIE_PATH,
  STUDENT_SESSION_DAYS,
  signStudentToken,
  verifyStudentToken,
  type StudentTokenPayload,
} from "./student-token";

// Student sessions: the token carries only one studentId and the code
// version — nothing to widen access with. Valid only while the code is still
// the same version, the student isn't archived, and her course has student
// login turned on (turning it off ends every open session on its next request).

export async function createStudentSession(payload: StudentTokenPayload) {
  const store = await cookies();
  store.set(STUDENT_COOKIE_NAME, await signStudentToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: STUDENT_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * STUDENT_SESSION_DAYS,
  });
}

export async function destroyStudentSession() {
  const store = await cookies();
  // expire it at the same path it was set on — delete(name) targets path "/"
  store.set(STUDENT_COOKIE_NAME, "", { path: STUDENT_COOKIE_PATH, maxAge: 0 });
}

export type StudentAccess = {
  studentId: string;
  courseId: string;
  groupId: string;
  boardEnabled: boolean;
  homeLogEnabled: boolean;
  // marking her own mistakes in home practice (only with the home log on)
  homeMistakesEnabled: boolean;
  assignmentsEnabled: boolean;
  trackerEnabled: boolean;
  // «الجدول اليومي» (only with the tracker)
  trackerAgendaEnabled: boolean;
  // «المحصّلات» (only with the tracker)
  trackerSummaryEnabled: boolean;
  // «المتشابهات» marks (in «حفظي في البيت», so only with the home log)
  mutashabihatEnabled: boolean;
  // detailed tajweed in her own home marks (lib/tajweed): only with home
  // marking on, the course switch on, and her «محاسبة على التجويد المفصّل»
  tajweedDetail: boolean;
};

/** The signed-in student, or null. One lookup per request (cached). */
export const getStudentAccess = cache(async (): Promise<StudentAccess | null> => {
  const store = await cookies();
  const raw = store.get(STUDENT_COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = await verifyStudentToken(raw);
  if (!payload) return null;

  const student = await prisma.student.findUnique({
    where: { id: payload.studentId },
    select: {
      studentCode: true,
      studentCodeVersion: true,
      archivedAt: true,
      courseId: true,
      groupId: true,
      tajweedDetailed: true,
      course: {
        select: {
          studentLoginEnabled: true,
          studentBoardEnabled: true,
          homeLogEnabled: true,
          homeMistakesEnabled: true,
          assignmentsEnabled: true,
          trackerEnabled: true,
          trackerAgendaEnabled: true,
          trackerSummaryEnabled: true,
          mutashabihatStudentsEnabled: true,
          tajweedDetailEnabled: true,
        },
      },
    },
  });
  if (
    !student?.studentCode ||
    student.studentCodeVersion !== payload.v ||
    student.archivedAt ||
    !student.course.studentLoginEnabled
  ) {
    return null;
  }
  return {
    studentId: payload.studentId,
    courseId: student.courseId,
    groupId: student.groupId,
    boardEnabled: student.course.studentBoardEnabled,
    homeLogEnabled: student.course.homeLogEnabled,
    homeMistakesEnabled: student.course.homeLogEnabled && student.course.homeMistakesEnabled,
    assignmentsEnabled: student.course.assignmentsEnabled,
    trackerEnabled: student.course.trackerEnabled,
    trackerAgendaEnabled: student.course.trackerEnabled && student.course.trackerAgendaEnabled,
    trackerSummaryEnabled: student.course.trackerEnabled && student.course.trackerSummaryEnabled,
    mutashabihatEnabled: student.course.homeLogEnabled && student.course.mutashabihatStudentsEnabled,
    tajweedDetail:
      student.course.homeLogEnabled && student.course.homeMistakesEnabled && student.course.tajweedDetailEnabled && student.tajweedDetailed,
  };
});

export async function requireStudentAccess(): Promise<StudentAccess> {
  const access = await getStudentAccess();
  if (!access) redirect("/student/login");
  return access;
}
