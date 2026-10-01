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
  assignmentsEnabled: boolean;
  trackerEnabled: boolean;
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
      course: {
        select: {
          studentLoginEnabled: true,
          studentBoardEnabled: true,
          homeLogEnabled: true,
          assignmentsEnabled: true,
          trackerEnabled: true,
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
    assignmentsEnabled: student.course.assignmentsEnabled,
    trackerEnabled: student.course.trackerEnabled,
  };
});

export async function requireStudentAccess(): Promise<StudentAccess> {
  const access = await getStudentAccess();
  if (!access) redirect("/student/login");
  return access;
}
