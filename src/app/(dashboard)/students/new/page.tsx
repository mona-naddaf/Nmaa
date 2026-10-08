import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { NewStudentForm } from "./NewStudentForm";
import { staffInfoAccess, visibleInfoFields } from "@/lib/students/extra-info";
import { canAddStudents, teacherGroupLimit } from "@/lib/students/manage";

export default async function NewStudentPage() {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  });

  if (!canAddStudents(session, course)) redirect("/students");

  // a teacher adds only into the groups she sees
  const groupLimit = await teacherGroupLimit(session, course);
  const groups = groupLimit ? course.groups.filter((g) => groupLimit.includes(g.id)) : course.groups;

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  // extra info: only the fields this viewer may edit (a teacher without the
  // edit-students permission adds a student without them)
  const infoAccess = staffInfoAccess(session, course);
  const infoFields = infoAccess.edit ? await visibleInfoFields(course.id, infoAccess) : [];

  return (
    <NewStudentForm
      infoFields={infoFields}
      groups={groups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))}
      viewerGender={viewer?.gender ?? null}
    />
  );
}
