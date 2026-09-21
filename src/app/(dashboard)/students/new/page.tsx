import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { NewStudentForm } from "./NewStudentForm";

export default async function NewStudentPage() {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  });

  const canAdd = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";
  if (!canAdd) redirect("/students");

  const viewer =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true } });

  return (
    <NewStudentForm
      groups={course.groups.map((g) => ({ id: g.id, name: g.name, gender: g.gender }))}
      viewerGender={viewer?.gender ?? null}
    />
  );
}
