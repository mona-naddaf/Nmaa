import styles from "./home-log.module.css";
import { HOME_TAP_ICON, HOME_TAP_KINDS, type HomeCounts } from "@/lib/home-log/rules";
import type { HomeLogView, HomeSegmentView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { TargetProgress, segmentTitle } from "./TargetProgress";

// Read-only view of a student's home log, for the staff student page and the
// parent view. Staff pass `segmentExtra` to add target editing per segment.
export function HomeLogSummary({
  log,
  groupGender: g,
  segmentExtra,
}: {
  log: HomeLogView;
  groupGender: GroupGender;
  segmentExtra?: (s: HomeSegmentView) => React.ReactNode;
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  return (
    <div>
      <div className={styles.muted} style={{ marginBottom: 10 }}>
        آخر نشاط: <b>{log.lastActivity ?? "لا يوجد بعد"}</b> · سجلّ منفصل عن التسميع الرسمي، لا يغيّر موقع{" "}
        {p("الطالب", "الطالبة")} في الخطة.
      </div>

      {log.active.length === 0 && log.past.length === 0 ? (
        <div className={styles.empty}>لم {p("يُضِف", "تُضِف")} أي مقطع بعد.</div>
      ) : (
        <>
          {log.active.length > 0 && <SegmentList title="قيد الحفظ" segments={log.active} extra={segmentExtra} />}
          {log.past.length > 0 && <SegmentList title="مقاطع سابقة" segments={log.past} />}
        </>
      )}
    </div>
  );
}

function SegmentList({
  title,
  segments,
  extra,
}: {
  title: string;
  segments: HomeSegmentView[];
  extra?: (s: HomeSegmentView) => React.ReactNode;
}) {
  return (
    <>
      <div className={styles.sectionTitle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {segments.map((s) => (
          <div key={s.id} className={`${styles.segCard} ${s.targetsMet ? styles.done : ""}`}>
            <div className={styles.segTitle}>
              {segmentTitle(s)}
              {s.assignmentId && <span className={`${styles.badge} ${styles.teacher}`}>📌 واجب</span>}
              {s.targetsMet && <span className={styles.badge}>أُنجزت الأهداف</span>}
              {s.finishedBy === "TEACHER_RECITED" && <span className={`${styles.badge} ${styles.teacher}`}>سُمِّع للمعلم ✓</span>}
              {s.finishedBy === "STUDENT" && <span className={styles.badge}>أُتمّ</span>}
            </div>
            <div className={styles.segMeta}>
              بدأ {s.createdAt}
              {s.finishedAt && ` · انتهى ${s.finishedAt}`}
              {s.lastActivity && ` · آخر نشاط ${s.lastActivity}`}
            </div>
            <TargetProgress counts={s.counts} targets={s.targets} />
            <AyahTable segment={s} />
            {extra?.(s)}
          </div>
        ))}
      </div>
    </>
  );
}

function AyahTable({ segment: s }: { segment: HomeSegmentView }) {
  const ayat = Object.keys(s.ayahCounts)
    .map(Number)
    .sort((a, b) => a - b);
  if (ayat.length === 0) return null;
  const cell = (c: HomeCounts | undefined, k: (typeof HOME_TAP_KINDS)[number]) => c?.[k] ?? 0;
  return (
    <details style={{ marginTop: 8 }}>
      <summary className={styles.muted} style={{ cursor: "pointer" }}>
        التدريب على الآيات منفردة ({ayat.length})
      </summary>
      <table className={styles.ayahTable}>
        <thead>
          <tr>
            <th>الآية</th>
            {HOME_TAP_KINDS.map((k) => (
              <th key={k}>{HOME_TAP_ICON[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ayat.map((a) => (
            <tr key={a}>
              <td>{a}</td>
              {HOME_TAP_KINDS.map((k) => (
                <td key={k}>{cell(s.ayahCounts[a], k)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
