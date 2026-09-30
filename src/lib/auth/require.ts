import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, type Session } from "@/lib/auth/session";

// A signed teacher session outlives what it points at: it's refused (and its
// cookie cleared via /auth/signout) once that teacher row is gone, belongs to
// another course, or is the supervisor's stand-in row — the last covers any
// session opened before the stand-in was locked out of login. Cached per
// request so the layout and page share one lookup.
const teacherSessionStillValid = cache(async (teacherId: string, courseId: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { courseId: true, isSupervisorProxy: true },
  });
  return !!teacher && teacher.courseId === courseId && !teacher.isSupervisorProxy;
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role === "teacher" && !(await teacherSessionStillValid(session.teacherId, session.courseId))) {
    redirect("/auth/signout");
  }
  return session;
}

export async function requireAdmin(): Promise<Extract<Session, { role: "admin" }>> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/students");
  return session;
}
