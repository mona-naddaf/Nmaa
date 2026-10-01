import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getStudentAssignments } from "@/lib/assignments/data";
import { syncStudentAssignmentSegments } from "@/lib/assignments/segments";
import { StudentAssignments } from "./StudentAssignments";

// «الواجبات»: her assignments, open first, with the big ✓. Refused (not
// just hidden) when the course has assignments off.
export default async function StudentAssignmentsPage() {
  const { studentId, assignmentsEnabled, homeLogEnabled } = await requireStudentAccess();
  if (!assignmentsEnabled) redirect("/student");

  // «واجب» segments of group assignments set before she joined
  await syncStudentAssignmentSegments(studentId);
  const [assignments, { group }] = await Promise.all([
    getStudentAssignments(studentId),
    prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { group: { select: { gender: true } } } }),
  ]);

  return <StudentAssignments assignments={assignments} groupGender={group.gender} linkSegments={homeLogEnabled} />;
}
