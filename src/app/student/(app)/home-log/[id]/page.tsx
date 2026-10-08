import { redirect } from "next/navigation";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getHomeLog } from "@/lib/home-log/data";
import { prisma } from "@/lib/db";
import { SegmentPractice } from "@/components/home-log/SegmentPractice";
import { PracticeWithMarks } from "@/components/home-log/PracticeWithMarks";
import { homeMarkFlags } from "@/lib/home-log/self-marks";
import { deleteSegmentAction, finishSegmentAction, markHomeWordAction, tapAction, undoTapAction } from "../actions";

// One active segment of hers: big counters + the ayat. Anything else (not
// hers, finished, home log off) goes back to the list.
export default async function SegmentPage({ params }: PageProps<"/student/home-log/[id]">) {
  const { id } = await params;
  const { studentId, homeLogEnabled, homeMistakesEnabled } = await requireStudentAccess();
  if (!homeLogEnabled) redirect("/student");

  const log = await getHomeLog(studentId, { pastLimit: 0 });
  const segment = log.active.find((s) => s.id === id);
  if (!segment) redirect("/student/home-log");

  const { group } = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { group: { select: { gender: true } } } });
  const actions = { tap: tapAction, undoTap: undoTapAction, finish: finishSegmentAction, remove: deleteSegmentAction };
  // marking her own mistakes, when the course allows it (private to her)
  if (homeMistakesEnabled) {
    return (
      <PracticeWithMarks
        segment={segment}
        groupGender={group.gender}
        actions={actions}
        listHref="/student/home-log"
        initialFlags={await homeMarkFlags(studentId, segment.surahNumber, segment.fromAyah, segment.toAyah)}
        mark={markHomeWordAction}
      />
    );
  }
  return <SegmentPractice segment={segment} groupGender={group.gender} actions={actions} listHref="/student/home-log" />;
}
