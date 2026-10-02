import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { logoutAction } from "@/app/login/actions";
import { supervisorNoun } from "@/lib/text/gender";
import { NavLinks } from "./NavLinks";
import { GenderPrompt } from "./GenderPrompt";
import styles from "./shell.module.css";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const course = await prisma.course.findUnique({
    where: { id: session.courseId },
    select: { name: true, calendarEnabled: true, studentLoginEnabled: true, assignmentsEnabled: true, trackerEnabled: true },
  });

  const account =
    session.role === "admin"
      ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { gender: true, genderPrompted: true } })
      : await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { gender: true, genderPrompted: true } });

  const genderPrompted = account?.genderPrompted ?? true;
  const adminGender = session.role === "admin" ? (account?.gender ?? null) : null;

  return (
    <div className={styles.shell}>
      <GenderPrompt initiallyPrompted={genderPrompted} />
      {/* outside the card, at the top-left corner (the row's end in RTL) */}
      <div className={styles.topLinks}>
        <form action={logoutAction}>
          <button className={styles.logoutLink} type="submit">
            تسجيل خروج
          </button>
        </form>
      </div>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <BrandLogo variant="header" priority />
        </div>
        <NavLinks
          showSettings={session.role === "admin"}
          showCalendar={course?.calendarEnabled ?? false}
          showAssignments={!!course?.studentLoginEnabled && course.assignmentsEnabled}
          showTracker={!!course?.studentLoginEnabled && course.trackerEnabled}
        />
        <div className={styles.who}>
          <span>
            <b>{course?.name}</b>
            {session.role === "teacher" && <> · {session.teacherName}</>}
            {session.role === "admin" && <> · {supervisorNoun(adminGender)} الدورة</>}
          </span>
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
