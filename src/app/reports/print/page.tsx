import { resolveReportScope, getReportRows } from "@/lib/reports/data";
import { studentNounDef } from "@/lib/text/gender";
import { PrintTrigger } from "./PrintTrigger";
import styles from "./print.module.css";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { session, resolved } = await resolveReportScope(params);
  const rows = await getReportRows(session.courseId, resolved);

  const scopeLabel =
    resolved.scope === "student"
      ? `${studentNounDef(resolved.scopeGender)}: ${resolved.visibleStudents.find((s) => s.id === resolved.studentId)?.name ?? ""}`
      : resolved.scope === "group"
        ? `المجموعة: ${resolved.visibleGroups.find((g) => g.id === resolved.groupIds?.[0])?.name ?? ""}`
        : "الدورة كاملة";

  const fromISO = resolved.from.toISOString().slice(0, 10);
  const toISO = resolved.to.toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <div className={styles.brand}>نماء 🌱</div>
      <div className={styles.meta}>{resolved.courseName}</div>
      <div className={styles.meta}>النطاق: {scopeLabel}</div>
      <div className={styles.meta}>
        الفترة: {fromISO} إلى {toISO}
      </div>

      <PrintTrigger />

      {rows.length === 0 ? (
        <div className={styles.emptyMsg}>لا توجد بيانات ضمن هذا النطاق والفترة</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{studentNounDef(resolved.scopeGender)}</th>
              <th>المجموعة</th>
              <th>إجمالي الصفحات</th>
              <th>أيام الحضور</th>
              <th>إجمالي النقاط</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td>{r.name}</td>
                <td>{r.groupName}</td>
                <td>{r.totalPages}</td>
                <td>{r.attendanceDays}</td>
                <td>{r.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
