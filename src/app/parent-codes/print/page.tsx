import { headers } from "next/headers";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { getParentCodeRows } from "@/lib/parent/codes";
import { studentNounDef, studentsNoun, NEUTRAL_GROUP_GENDER } from "@/lib/text/gender";
import { todayISO } from "@/lib/attendance";
import { PrintTrigger } from "@/app/reports/print/PrintTrigger";
import styles from "@/app/reports/print/print.module.css";

// Printable list of every student's parent code, for handing out to
// families. Supervisor-only, like everything else touching parent codes.
// Course-wide, so student words use the app's neutral convention.
export default async function ParentCodesPrintPage() {
  const session = await requireAdmin();
  const g = NEUTRAL_GROUP_GENDER;
  const [rows, course, h] = await Promise.all([
    getParentCodeRows(session.courseId),
    prisma.course.findUniqueOrThrow({ where: { id: session.courseId }, select: { name: true } }),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const loginUrl = host ? `${proto}://${host}/parent/login` : null;

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <BrandLogo variant="print" priority />
      </div>
      <div className={styles.meta}>{course.name}</div>
      <div className={styles.meta}>رموز دخول أولياء الأمور — {todayISO()}</div>
      {loginUrl && (
        <div className={styles.meta}>
          يسجّل وليّ الأمر دخوله من الصفحة <bdi dir="ltr">{loginUrl}</bdi> باسم {studentNounDef(g)} والرمز
        </div>
      )}

      <PrintTrigger />

      {rows.length === 0 ? (
        <div className={styles.emptyMsg}>لا يوجد {studentsNoun(g)} في الدورة بعد</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{studentNounDef(g)}</th>
              <th>المجموعة</th>
              <th>رمز وليّ الأمر</th>
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
