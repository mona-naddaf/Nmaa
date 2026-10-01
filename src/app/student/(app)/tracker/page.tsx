import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getStudentTracker } from "@/lib/tracker/data";
import { StudentTracker } from "./StudentTracker";

// «جدول المتابعة»: today and yesterday as big tick tiles, the day's score,
// the last seven days, and her own items. Refused (not just hidden) when the
// course has the tracker off.
export default async function StudentTrackerPage() {
  const { studentId, trackerEnabled } = await requireStudentAccess();
  if (!trackerEnabled) redirect("/student");

  const [sheet, { group }] = await Promise.all([
    getStudentTracker(studentId, 9),
    prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { group: { select: { gender: true } } } }),
  ]);
  return <StudentTracker sheet={sheet} groupGender={group.gender} />;
}
