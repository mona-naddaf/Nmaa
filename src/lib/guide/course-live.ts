import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { courseGuideAllowed, courseGuideListed } from "./course-enabled";

// Whether a course is in COURSE_GUIDE_EMAILS (its supervisor's email): its
// pages get the guide and the clarity fixes. One query per request, and none
// at all while the list is empty.
export const courseGuideOn = cache(async (courseId: string): Promise<boolean> => {
  if (!courseGuideListed()) return false;
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { admin: { select: { email: true } } } });
  return !!c && courseGuideAllowed(c.admin.email);
});
