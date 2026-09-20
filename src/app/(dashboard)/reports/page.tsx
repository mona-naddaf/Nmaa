import { resolveReportScope, getReportRows } from "@/lib/reports/data";
import { ReportFilters } from "./ReportFilters";
import styles from "./reports.module.css";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { session, resolved } = await resolveReportScope(params);
  const rows = await getReportRows(session.courseId, resolved);

  const fromISO = resolved.from.toISOString().slice(0, 10);
  const toISO = resolved.to.toISOString().slice(0, 10);
  const courseCreatedISO = fromISO; // resolveReportScope already defaults `from` to course creation

  const downloadQuery = new URLSearchParams({
    scope: resolved.scope,
    ...(resolved.groupIds?.[0] ? { groupId: resolved.groupIds[0] } : {}),
    ...(resolved.studentId ? { studentId: resolved.studentId } : {}),
    from: fromISO,
    to: toISO,
  }).toString();

  return (
    <div>
      <div className={styles.subtitle}>تقرير قابل للتنزيل — إجمالي الصفحات والحضور والنقاط لكل طالبة ضمن النطاق والفترة المحدَّدة</div>

      <ReportFilters
        scope={resolved.scope}
        groupId={resolved.groupIds?.[0]}
        studentId={resolved.studentId}
        from={fromISO}
        to={toISO}
        courseCreatedAt={courseCreatedISO}
        today={new Date().toISOString().slice(0, 10)}
        groups={resolved.visibleGroups}
        students={resolved.visibleStudents}
      />

      <div className={styles.card}>
        <div className={styles.downloadRow}>
          <a className={`${styles.downloadBtn} ${styles.excel}`} href={`/api/reports/excel?${downloadQuery}`}>
            ⬇️ تنزيل Excel
          </a>
          <a className={`${styles.downloadBtn} ${styles.pdf}`} href={`/reports/print?${downloadQuery}`} target="_blank" rel="noopener">
            🖨️ تنزيل PDF
          </a>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div className={styles.emptyMsg}>لا توجد بيانات ضمن هذا النطاق والفترة</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الطالبة</th>
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
                  <td className={styles.numCell}>{r.totalPages}</td>
                  <td className={styles.numCell}>{r.attendanceDays}</td>
                  <td className={styles.numCell}>{r.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
