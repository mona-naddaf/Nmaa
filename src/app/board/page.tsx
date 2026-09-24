import { redirect } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";
import { requireBoardCourseId } from "@/lib/auth/board-session";
import { getBoardData } from "@/lib/board/data";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { boardLogoutAction } from "./actions";

// Public read-only board: the leaderboard and nothing else — no nav, no
// links into the staff app, and no server actions besides exit.
export default async function BoardPage() {
  const courseId = await requireBoardCourseId();
  const data = await getBoardData(courseId);
  if (!data) redirect("/board/login");

  return (
    <div className={shell.shell}>
      <div className={shell.bar}>
        <div className={shell.brand}>نماء 🌱</div>
        <div className={shell.who}>
          <span>
            لوحة إنجاز · <b>{data.courseName}</b>
          </span>
          <form action={boardLogoutAction}>
            <button className={shell.logoutBtn} type="submit">
              خروج
            </button>
          </form>
        </div>
      </div>
      <div className={shell.content}>
        <Leaderboard
          students={data.students}
          groups={data.groups}
          dailyEntries={data.dailyEntries}
          subtitle={`لوحة إنجاز ${data.courseName} — للعرض فقط`}
        />
      </div>
    </div>
  );
}
