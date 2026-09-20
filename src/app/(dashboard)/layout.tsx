import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { logoutAction } from "@/app/login/actions";
import { NavLinks } from "./NavLinks";
import styles from "./shell.module.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const course = await prisma.course.findUnique({
    where: { id: session.courseId },
    select: { name: true },
  });

  return (
    <div className={styles.shell}>
      <div className={styles.bar}>
        <div className={styles.brand}>نماء 🌱</div>
        <NavLinks showSettings={session.role === "admin"} />
        <div className={styles.who}>
          <span>
            <b>{course?.name}</b>
            {session.role === "teacher" && <> · {session.teacherName}</>}
            {session.role === "admin" && <> · مديرة الدورة</>}
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
