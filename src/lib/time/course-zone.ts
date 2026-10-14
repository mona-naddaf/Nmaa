import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { safeTimeZone } from "./zone";

/** The course's time zone (lib/time/zone.ts). One lookup per request. */
export const courseTimeZone = cache(async (courseId: string): Promise<string> => {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { timeZone: true } });
  return safeTimeZone(course?.timeZone);
});

/** The zone of the course a student belongs to. */
export async function studentTimeZone(studentId: string): Promise<string> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { courseId: true } });
  return student ? courseTimeZone(student.courseId) : safeTimeZone(null);
}
