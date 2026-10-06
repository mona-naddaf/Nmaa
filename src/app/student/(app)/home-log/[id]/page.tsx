import { redirect } from "next/navigation";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getHomeLog } from "@/lib/home-log/data";
import { prisma } from "@/lib/db";
import { SegmentPractice } from "@/components/home-log/SegmentPractice";
import { deleteSegmentAction, finishSegmentAction, tapAction, undoTapAction } from "../actions";

// One active segment of hers: big counters + the ayat. Anything else (not
// hers, finished, home log off) goes back to the list.
export default async function SegmentPage({ params }: PageProps<"/student/home-log/[id]">) {
  const { id } = await params;
  const { studentId, homeLogEnabled } = await requireStudentAccess();
  if (!homeLogEnabled) redirect("/student");

  const log = await getHomeLog(studentId, { pastLimit: 0 });
  const segment = log.active.find((s) => s.id === id);
  if (!segment) redirect("/student/home-log");

  const { group } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { group: { select: { gender: true } } } });
  return (
    <SegmentPractice
      segment={segment}
      groupGender={group.gender}
      actions={{ tap: tapAction, undoTap: undoTapAction, finish: finishSegmentAction, remove: deleteSegmentAction }}
      listHref="/student/home-log"
    />
  );
}
