import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";

const ADMIN_TEACHER_NAME = "مديرة الدورة";

// RecitationSession/PointsLog attribute every entry to a Teacher row. When an
// admin performs the action directly (rather than a named teacher), we
// attribute it to a synthetic per-course "مديرة الدورة" teacher record.
export async function resolveTeacherId(session: Session): Promise<string> {
  if (session.role === "teacher") return session.teacherId;

  const nameKey = ADMIN_TEACHER_NAME;
  const teacher = await prisma.teacher.upsert({
    where: { courseId_nameKey: { courseId: session.courseId, nameKey } },
    update: {},
    create: { courseId: session.courseId, name: ADMIN_TEACHER_NAME, nameKey },
  });
  return teacher.id;
}
