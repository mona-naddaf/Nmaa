"use client";

import { useState } from "react";
import styles from "@/components/home-log/home-log.module.css";
import { NewSegment } from "@/components/home-log/NewSegment";
import { SegmentCard } from "@/components/home-log/SegmentCard";
import { HOME_LIMITS } from "@/lib/home-log/rules";
import type { HomeLogView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { createSegmentAction } from "./actions";

export function HomeLogHome({
  log,
  groupGender: g,
  plan,
  suggestion,
}: {
  log: HomeLogView;
  groupGender: GroupGender;
  plan: number[];
  suggestion: { surahNumber: number; fromAyah: number; toAyah: number };
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [adding, setAdding] = useState(false);
  // D4: «واجب» segments don't count toward her limit
  const full = log.active.filter((s) => !s.assignmentId).length >= HOME_LIMITS.maxActiveSegments;

  return (
    <div>
      <div className={styles.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>🏠 حفظي في البيت</span>
        {!adding && (
          <button type="button" className={styles.primaryBtn} onClick={() => setAdding(true)} disabled={full}>
            + مقطع جديد
          </button>
        )}
      </div>
      <p className={styles.muted} style={{ margin: "0 4px 12px" }}>
        {p("سجّل", "سجّلي")} هنا ما {p("تحفظه", "تحفظينه")} في البيت، {p("واضغط", "واضغطي")} «+» كلما{" "}
        {p("استمعتَ أو كرّرتَ أو سمّعتَ", "استمعتِ أو كرّرتِ أو سمّعتِ")} لأحد. هذا سجلّ للتدريب فقط، ولا يتقدّم موقعك في
        الخطة إلا بتسميع للمعلم.
      </p>
      {full && !adding && (
        <p className={styles.err} style={{ margin: "0 4px 12px" }}>
          لديك {HOME_LIMITS.maxActiveSegments} مقاطع قيد الحفظ — {p("أتمّ", "أتمّي")} أحدها لإضافة مقطع جديد.
        </p>
      )}

      {adding && (
        <NewSegment
          g={g}
          plan={plan}
          suggestion={suggestion}
          suggestionNote={`المقترح: ما بعد موقعك الرسمي في الخطة، ${p("ويمكنك", "ويمكنكِ")} اختيار غيره.`}
          create={createSegmentAction}
          practiceBase="/student/home-log"
          onCancel={() => setAdding(false)}
        />
      )}

      <div className={styles.sectionTitle}>قيد الحفظ</div>
      {log.active.length === 0 ? (
        <div className={styles.section}>
          <div className={styles.empty}>لا توجد مقاطع قيد الحفظ — {p("ابدأ", "ابدئي")} بإضافة مقطع جديد.</div>
        </div>
      ) : (
        <div className={styles.cards} style={{ marginBottom: 14 }}>
          {log.active.map((s) => (
            <SegmentCard key={s.id} s={s} g={g} href={`/student/home-log/${s.id}`} />
          ))}
        </div>
      )}

      {log.past.length > 0 && (
        <>
          <div className={styles.sectionTitle}>مقاطع سابقة</div>
          <div className={styles.cards}>
            {log.past.map((s) => (
              <SegmentCard key={s.id} s={s} g={g} href={`/student/home-log/${s.id}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
