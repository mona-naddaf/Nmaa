import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { supervisorNoun, type PersonGender } from "@/lib/text/gender";

// The stand-in row is found by its isSupervisorProxy flag, never by name.
// New stand-ins still get the original literal name key (it's a reserved
// name at login, see reserved-names.ts), so a real teacher can never hold it.
const SUPERVISOR_PROXY_NAME_KEY = "مديرة الدورة";

const proxyName = (gender: PersonGender) => `${supervisorNoun(gender)} الدورة`;

// RecitationSession/PointsLog/... attribute every entry to a Teacher row. When
// the supervisor performs the action directly (rather than a named teacher),
// it's attributed to a per-course stand-in row displayed as "مشرف/مشرفة
// الدورة". Its display name follows the supervisor's current gender.
export async function resolveTeacherId(session: Session): Promise<string> {
  if (session.role === "teacher") return session.teacherId;

  const admin = await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } });
  const name = proxyName(admin?.gender ?? null);

  const existing = await prisma.teacher.findFirst({
    where: { courseId: session.courseId, isSupervisorProxy: true },
    select: { id: true, name: true },
  });
  if (existing) {
    if (existing.name !== name) await prisma.teacher.update({ where: { id: existing.id }, data: { name } });
    return existing.id;
  }

  try {
    const created = await prisma.teacher.create({
      data: { courseId: session.courseId, name, nameKey: SUPERVISOR_PROXY_NAME_KEY, isSupervisorProxy: true },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    // two first-ever supervisor actions at once: the other one created it
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await prisma.teacher.findFirstOrThrow({
        where: { courseId: session.courseId, isSupervisorProxy: true },
        select: { id: true },
      });
      return raced.id;
    }
    throw e;
  }
}

/** Keeps the stand-in's display name in step when the supervisor sets their gender. */
export async function syncSupervisorProxyName(courseId: string, gender: PersonGender) {
  await prisma.teacher.updateMany({
    where: { courseId, isSupervisorProxy: true },
    data: { name: proxyName(gender) },
  });
}
