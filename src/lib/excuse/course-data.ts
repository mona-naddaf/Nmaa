import "server-only";
import { prisma } from "@/lib/db";
import { excuseAllowed, excuseEnabled } from "./enabled";

// «أيام العذر» in a course. Who sees is decided on the server, before
// anything about an excuse is loaded (src/lib/excuse/visibility.ts).

/**
 * The feature reaches this course at all: EXCUSE_ENABLED, and its
 * supervisor's email in EXCUSE_ALLOW_EMAILS («*» = every course). Without
 * it the switch isn't offered and Course.excuseEnabled is ignored.
 */
export async function courseExcuseAllowed(courseId: string): Promise<boolean> {
  if (!excuseEnabled()) return false;
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { admin: { select: { email: true } } } });
  return !!c && excuseAllowed(c.admin.email);
}
