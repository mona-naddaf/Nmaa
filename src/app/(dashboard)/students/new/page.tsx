import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { NewStudentForm } from "./NewStudentForm";
import styles from "./new-student.module.css";

export default async function NewStudentPage() {
  const session = await requireSession();
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  });

  const canAdd = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";
  if (!canAdd) redirect("/students");

  return (
    <div>
      <div className={styles.subtitle}>إضافة طالبة جديدة وتحديد خطة الحفظ الخاصة بها</div>
      <NewStudentForm groups={course.groups.map((g) => ({ id: g.id, name: g.name }))} />
    </div>
  );
}
