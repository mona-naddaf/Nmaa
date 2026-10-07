"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/home-log/home-log.module.css";
import { NewSegment } from "@/components/home-log/NewSegment";
import { SegmentCard } from "@/components/home-log/SegmentCard";
import { TargetsEditor } from "@/components/home-log/TargetsEditor";
import { HOME_LIMITS, type HomeTargets } from "@/lib/home-log/rules";
import type { HomeLogView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { createSegmentAction, setTargetsAction } from "./actions";

// Her «حفظي في البيت» list: the shared cards and new-passage form, with her
// own targets and wording.
export function RafiqHomeLog({
  log,
  g,
  plan,
  suggestion,
  targets,
}: {
  log: HomeLogView;
  g: GroupGender;
  plan: number[];
  suggestion: { surahNumber: number; fromAyah: number; toAyah: number };
  targets: HomeTargets;
}) {
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [adding, setAdding] = useState(false);
  const [editingTargets, setEditingTargets] = useState(false);
  const full = log.active.length >= HOME_LIMITS.maxActiveSegments;
  const recited = "سُجِّل في جلساتك ✓";

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
        {p("سجّل", "سجّلي")} هنا ما {p("تحفظه", "تحفظينه")}، {p("واضغط", "واضغطي")} «+» كلما{" "}
        {p("استمعتَ أو كرّرتَ أو سمّعتَ", "استمعتِ أو كرّرتِ أو سمّعتِ")} لأحد. هذا سجلّ للتدريب فقط، ولا يتقدّم موضعك في خطتك إلا
        بتسجيل جلسة حفظ جديد في صفحتك.
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
          suggestionNote={`المقترح: ما بعد موضعك في خطتك، ${p("ويمكنك", "ويمكنكِ")} اختيار غيره.`}
          create={createSegmentAction}
          practiceBase="/rafiq/home-log"
          onCancel={() => setAdding(false)}
        />
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle} style={{ margin: "0 0 8px" }}>
          <span>أهدافي لكل مقطع</span>
          {!editingTargets && (
            <button type="button" className={styles.linkBtn} onClick={() => setEditingTargets(true)}>
              تعديل
            </button>
          )}
        </div>
        {editingTargets ? (
          <>
            <TargetsEditor
              initial={targets}
              onSave={async (t) => {
                const r = await setTargetsAction(t);
                if (!r.error) router.refresh();
                return r;
              }}
            />
            <div className={styles.muted} style={{ marginTop: 6 }}>
              تُطبَّق على المقاطع الجديدة وعلى المقاطع التي قيد الحفظ الآن.
            </div>
          </>
        ) : (
          <div className={styles.muted}>
            🎧 سماع {targets.listen} · 🔁 تكرار {targets.repeat} · 🗣️ تسميع لأحد {targets.recite}
          </div>
        )}
      </div>

      <div className={styles.sectionTitle}>قيد الحفظ</div>
      {log.active.length === 0 ? (
        <div className={styles.section}>
          <div className={styles.empty}>لا توجد مقاطع قيد الحفظ — {p("ابدأ", "ابدئي")} بإضافة مقطع جديد.</div>
        </div>
      ) : (
        <div className={styles.cards} style={{ marginBottom: 14 }}>
          {log.active.map((s) => (
            <SegmentCard key={s.id} s={s} g={g} href={`/rafiq/home-log/${s.id}`} recitedLabel={recited} />
          ))}
        </div>
      )}

      {log.past.length > 0 && (
        <>
          <div className={styles.sectionTitle}>مقاطع سابقة</div>
          <div className={styles.cards}>
            {log.past.map((s) => (
              <SegmentCard key={s.id} s={s} g={g} href={`/rafiq/home-log/${s.id}`} recitedLabel={recited} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
