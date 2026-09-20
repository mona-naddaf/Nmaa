import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getStudentSummaries } from "@/lib/students/summary";
import styles from "./students.module.css";
import { StudentsList } from "./StudentsList";

export default async function StudentsPage() {
  const session = await requireSession();

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: session.courseId },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  });

  let visibleGroupIds: string[] | undefined;
  if (session.role === "teacher" && course.visibilityMode === "ASSIGNED") {
    const assignments = await prisma.teacherGroupAssignment.findMany({
      where: { teacherId: session.teacherId },
      select: { groupId: true },
    });
    if (assignments.length > 0) {
      visibleGroupIds = assignments.map((a) => a.groupId);
    }
  }

  const visibleGroups = visibleGroupIds
    ? course.groups.filter((g) => visibleGroupIds!.includes(g.id))
    : course.groups;

  const students = await getStudentSummaries(course.id, visibleGroupIds);

  const canAddStudents = session.role === "admin" || course.addStudentsPermission === "ALL_TEACHERS";

  return (
    <div>
      {canAddStudents && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Link href="/students/new" className={styles.addBtn}>
            + إضافة طالبة جديدة
          </Link>
        </div>
      )}
      <StudentsList
        groups={visibleGroups.map((g) => ({ id: g.id, name: g.name }))}
        students={students}
      />
    </div>
  );
}
