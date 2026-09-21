import "server-only";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { supervisorNoun } from "@/lib/text/gender";

// nameKey is a fixed, gender-independent lookup key (unique per course) —
// kept at its original literal value so existing courses keep matching their
// existing synthetic teacher row and don't fragment their attribution
// history. The display name is regenerated from the admin's current gender
// on every call, so it self-heals if the admin sets/changes their gender.
const ADMIN_TEACHER_NAME_KEY = "مديرة الدورة";

// RecitationSession/PointsLog attribute every entry to a Teacher row. When an
// admin performs the action directly (rather than a named teacher), we
// attribute it to a synthetic per-course "مشرف/مشرفة الدورة" teacher record.
export async function resolveTeacherId(session: Session): Promise<string> {
  if (session.role === "teacher") return session.teacherId;

  const admin = await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } });
  const name = `${supervisorNoun(admin?.gender ?? null)} الدورة`;
  const nameKey = ADMIN_TEACHER_NAME_KEY;

  const teacher = await prisma.teacher.upsert({
    where: { courseId_nameKey: { courseId: session.courseId, nameKey } },
    update: { name },
    create: { courseId: session.courseId, name, nameKey },
  });
  return teacher.id;
}
