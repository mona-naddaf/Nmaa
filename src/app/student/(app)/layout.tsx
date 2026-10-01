import { BrandLogo } from "@/components/brand/BrandLogo";
import shell from "@/app/(dashboard)/shell.module.css";
import { prisma } from "@/lib/db";
import { requireStudentAccess } from "@/lib/auth/student-session";
import { studentLogoutAction } from "../actions";
import { StudentTabs } from "./StudentTabs";

// Shell for every signed-in student page. Phases 2–3 (home memorization log,
// assignments) add a tab in StudentTabs and a page next to page.tsx.
export default async function StudentAreaLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStudentAccess();
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: access.studentId },
    select: { name: true, group: { select: { name: true } }, course: { select: { name: true } } },
  });

  return (
    <div className={shell.shell}>
      <div className={shell.bar}>
        <div className={shell.brand}>
          <BrandLogo variant="header" priority />
        </div>
        <StudentTabs boardEnabled={access.boardEnabled} homeLogEnabled={access.homeLogEnabled} />
        <div className={shell.who}>
          <span>
            <b>{student.name}</b> · {student.group.name} · {student.course.name}
          </span>
          <form action={studentLogoutAction}>
            <button className={shell.logoutBtn} type="submit">
              خروج
            </button>
          </form>
        </div>
      </div>
      <div className={shell.content}>{children}</div>
    </div>
  );
}
