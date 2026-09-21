import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { logoutAction } from "@/app/login/actions";
import { supervisorNoun } from "@/lib/text/gender";
import { NavLinks } from "./NavLinks";
import { GenderPrompt } from "./GenderPrompt";
import styles from "./shell.module.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const course = await prisma.course.findUnique({
    where: { id: session.courseId },
    select: { name: true },
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
      <div className={styles.bar}>
        <div className={styles.brand}>نماء 🌱</div>
        <NavLinks showSettings={session.role === "admin"} />
        <div className={styles.who}>
          <span>
            <b>{course?.name}</b>
            {session.role === "teacher" && <> · {session.teacherName}</>}
            {session.role === "admin" && <> · {supervisorNoun(adminGender)} الدورة</>}
          </span>
          <form action={logoutAction}>
            <button className={styles.logoutBtn} type="submit">
              تسجيل خروج
            </button>
          </form>
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
