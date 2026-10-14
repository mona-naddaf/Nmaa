import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { courseSummary } from "@/lib/tracker/summary-data";
import { TrackerSummary } from "@/components/student-work/TrackerSummary";
import hl from "@/components/home-log/home-log.module.css";
import { mySummaryAction } from "../actions";

// «المحصّلات»: her tracker's periodic summaries. Refused (not just hidden)
// unless the course has the tracker and the summaries on.
export default async function StudentSummaryPage() {
  const { studentId, trackerEnabled, trackerSummaryEnabled } = await requireStudentAccess();
  if (!trackerEnabled || !trackerSummaryEnabled) redirect("/student/tracker");
  const [initial, { group }] = await Promise.all([
    courseSummary(studentId, "month", 0),
    prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { group: { select: { gender: true } } } }),
  ]);
  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>📊 المحصّلات</span>
        <Link href="/student/tracker" className={hl.linkBtn}>
          → جدول المتابعة
        </Link>
      </div>
      <TrackerSummary initial={initial} groupGender={group.gender} self load={mySummaryAction} />
    </div>
  );
}
