import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getStudentCodeRows, studentCodeAccess } from "@/lib/students/student-codes";
import { requestOrigin } from "@/lib/request-origin";
import { StudentCodesView } from "./StudentCodesView";

// Supervisor, or teachers when the course allows it (their groups only).
export default async function StudentCodesPage() {
  const session = await requireSession();
  const access = await studentCodeAccess(session);
  if (!access.allowed) redirect("/students");

  const [rows, viewer, origin] = await Promise.all([
    getStudentCodeRows(session.courseId, access.groupIds),
    session.role === "admin"
      ? prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } }),
    requestOrigin(),
  ]);
  return (
    <StudentCodesView
      rows={rows}
      viewerGender={viewer?.gender ?? null}
      loginUrl={origin ? `${origin}/student/login` : null}
      limitedToGroups={access.groupIds !== null}
    />
  );
}
