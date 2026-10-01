import { redirect } from "next/navigation";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { getBoardData } from "@/lib/board/data";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";

// The course's achievement board, exactly as the public board shows it
// (anonymized ids, names and totals only) — only when the course has turned
// on the board for students. Refused here, not just hidden from the tabs.
export default async function StudentBoardPage() {
  const { courseId, boardEnabled } = await requireStudentAccess();
  if (!boardEnabled) redirect("/student");
  const data = await getBoardData(courseId);
  if (!data) redirect("/student");
  return (
    <Leaderboard
      students={data.students}
      groups={data.groups}
      dailyEntries={data.dailyEntries}
      subtitle={`لوحة إنجاز ${data.courseName} — للعرض فقط`}
    />
  );
}
