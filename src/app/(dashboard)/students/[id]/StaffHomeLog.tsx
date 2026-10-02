"use client";

import styles from "@/components/home-log/home-log.module.css";
import { HomeLogSummary } from "@/components/home-log/HomeLogSummary";
import { TargetsEditor } from "@/components/home-log/TargetsEditor";
import type { HomeLogView } from "@/lib/home-log/data";
import type { HomeTargets } from "@/lib/home-log/rules";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { setSegmentTargetsAction, setStudentHomeTargetsAction } from "./home-log-actions";

// Staff view of the student's home log (the page only renders it for staff
// allowed to see this student). Editing targets is D2; the actions re-check.
export function StaffHomeLog({
  studentId,
  groupGender: g,
  log,
  targets,
  hasOwnTargets,
}: {
  studentId: string;
  groupGender: GroupGender;
  log: HomeLogView;
  targets: HomeTargets;
  hasOwnTargets: boolean;
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  return (
    <>
      {/* title and card come from the page's Collapsible */}
      <div>
        <HomeLogSummary
          log={log}
          groupGender={g}
          segmentExtra={(s) => (
            <details style={{ marginTop: 8 }}>
              <summary className={styles.linkBtn} style={{ cursor: "pointer" }}>
                تعديل أهداف هذا المقطع
              </summary>
              <div style={{ marginTop: 8 }}>
                <TargetsEditor initial={s.targets} onSave={(t) => setSegmentTargetsAction(s.id, t)} />
              </div>
            </details>
          )}
        />
        <div className={styles.section} style={{ marginTop: 6, marginBottom: 0, background: "var(--cream)" }}>
          <div className={styles.muted} style={{ fontWeight: 700, marginBottom: 6 }}>
            أهداف المقاطع الجديدة {p("لهذا الطالب", "لهذه الطالبة")}{" "}
            {hasOwnTargets ? "(أهداف خاصة)" : "(الأهداف الافتراضية للدورة)"}
          </div>
          <TargetsEditor
            initial={targets}
            onSave={(t) => setStudentHomeTargetsAction(studentId, t)}
            onReset={hasOwnTargets ? () => setStudentHomeTargetsAction(studentId, null) : undefined}
            resetLabel="العودة إلى الأهداف الافتراضية"
          />
        </div>
      </div>
    </>
  );
}
