import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { getStudentCodeRows, studentCodeAccess } from "@/lib/students/student-codes";
import { requestOrigin } from "@/lib/request-origin";
import { studentNounDef, studentsNoun, NEUTRAL_GROUP_GENDER } from "@/lib/text/gender";
import { todayISO } from "@/lib/attendance";
import { PrintTrigger } from "@/app/reports/print/PrintTrigger";
import styles from "@/app/reports/print/print.module.css";

// Printable list of student login codes. Same access as the codes page:
// supervisor, or permitted teachers for their own groups only.
export default async function StudentCodesPrintPage() {
  const session = await requireSession();
  const access = await studentCodeAccess(session);
  if (!access.allowed) redirect("/students");
  const g = NEUTRAL_GROUP_GENDER;
  const [rows, course, origin] = await Promise.all([
    getStudentCodeRows(session.courseId, access.groupIds),
    prisma.course.findUniqueOrThrow({ where: { id: session.courseId }, select: { name: true } }),
    requestOrigin(),
  ]);
  const loginUrl = origin ? `${origin}/student/login` : null;

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <BrandLogo variant="print" priority />
      </div>
      <div className={styles.meta}>{course.name}</div>
      <div className={styles.meta}>رموز دخول {studentsNoun(g)} — {todayISO()}</div>
      {loginUrl && (
        <div className={styles.meta}>
          يدخل {studentNounDef(g)} من الصفحة <bdi dir="ltr">{loginUrl}</bdi> بالاسم والرمز
        </div>
      )}

      <PrintTrigger />

      {rows.length === 0 ? (
        <div className={styles.emptyMsg}>لا يوجد {studentsNoun(g)} بعد</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{studentNounDef(g)}</th>
              <th>المجموعة</th>
              <th>رمز الدخول</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.groupName}</td>
                <td>
                  {r.code ? (
                    <bdi dir="ltr" style={{ fontFamily: "ui-monospace, Consolas, monospace", fontWeight: 700, letterSpacing: "0.06em" }}>
                      {r.code}
                    </bdi>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
