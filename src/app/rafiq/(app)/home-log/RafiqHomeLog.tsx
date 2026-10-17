"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/home-log/home-log.module.css";
import { NewSegment } from "@/components/home-log/NewSegment";
import { VerseNoteMarker } from "../notes/NotesProvider";
import { SegmentCard } from "@/components/home-log/SegmentCard";
import { TargetsEditor } from "@/components/home-log/TargetsEditor";
import { HOME_LIMITS, type HomeTargets } from "@/lib/home-log/rules";
import type { HomeLogView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { createSegmentAction, setTargetsAction } from "./actions";
import type { RafiqViewer } from "@/lib/rafiq/scope";

// Her «حفظي في البيت» list: the shared cards and new-passage form, with her
// own targets and wording. «العائلة»: a child's list — for the child herself,
// or for an adult of her family (with edit rights: adding passages and
// practising with her; view only: the cards, without opening them).
export function RafiqHomeLog({
  log,
  g,
  plan,
  suggestion,
  targets,
  viewer = "self",
  subjectId,
  base = "/rafiq/home-log",
  childName,
  you = null,
}: {
  log: HomeLogView;
  g: GroupGender;
  plan: number[];
  suggestion: { surahNumber: number; fromAyah: number; toAyah: number };
  targets: HomeTargets;
  viewer?: RafiqViewer;
  subjectId?: string;
  // where the passages open (base/id)
  base?: string;
  // the child's name (an adult's view)
  childName?: string;
  // the adult looking (an adult's view), for «يمكنكِ»
  you?: "MALE" | "FEMALE" | null;
}) {
  const router = useRouter();
  // g: whose list it is (her own, or the child's)
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const adult = viewer === "adult-edit" || viewer === "adult-view";
  const canAdd = viewer !== "adult-view";
  // targets are the adults' to set on a child's list
  const canTargets = viewer === "self" || viewer === "adult-edit";
  const y = (m: string, f: string) => (you === "FEMALE" ? f : m);
  const create = (input: { surahNumber: number; fromAyah: number; toAyah: number }) => createSegmentAction({ ...input, subjectId });
  const [adding, setAdding] = useState(false);
  const [editingTargets, setEditingTargets] = useState(false);
  const full = log.active.length >= HOME_LIMITS.maxActiveSegments;
  const recited = "سُجِّل في جلساتك ✓";

  return (
    <div>
      <div className={styles.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>{adult ? `🏠 حفظ ${childName} في البيت` : "🏠 حفظي في البيت"}</span>
        {!adding && canAdd && (
          <button type="button" className={styles.primaryBtn} onClick={() => setAdding(true)} disabled={full}>
            + مقطع جديد
          </button>
        )}
      </div>
      {adult ? (
        <p className={styles.muted} style={{ margin: "0 4px 12px" }}>
          {viewer === "adult-edit"
            ? `مقاطع ${childName} في البيت. ${y("يمكنك", "يمكنكِ")} إضافة مقطع ${p("له", "لها")} والتسجيل ${p("معه", "معها")} في صفحة المقطع.`
            : `مقاطع ${childName} في البيت — مشاهدة فقط.`}
        </p>
      ) : (
      <p className={styles.muted} style={{ margin: "0 4px 12px" }}>
        {p("سجّل", "سجّلي")} هنا ما {p("تحفظه", "تحفظينه")}، {p("واضغط", "واضغطي")} «+» كلما{" "}
        {p("استمعتَ أو كرّرتَ أو سمّعتَ", "استمعتِ أو كرّرتِ أو سمّعتِ")} لأحد. هذا سجلّ للتدريب فقط، ولا يتقدّم موضعك في خطتك إلا
        بتسجيل جلسة حفظ جديد في صفحتك.
      </p>
      )}
      {full && !adding && canAdd && (
        <p className={styles.err} style={{ margin: "0 4px 12px" }}>
          لديك {HOME_LIMITS.maxActiveSegments} مقاطع قيد الحفظ — {p("أتمّ", "أتمّي")} أحدها لإضافة مقطع جديد.
        </p>
      )}

      {adding && (
        <NewSegment
          g={g}
          plan={plan}
          suggestion={suggestion}
          suggestionNote={
            adult
              ? `المقترح: ما بعد موضع ${childName} في ${p("خطته", "خطتها")}، ${y("ويمكنك", "ويمكنكِ")} اختيار غيره.`
              : `المقترح: ما بعد موضعك في خطتك، ${p("ويمكنك", "ويمكنكِ")} اختيار غيره.`
          }
          planMark={adult ? `★ سور خطة ${childName}` : undefined}
          create={create}
          practiceBase={base}
          onCancel={() => setAdding(false)}
          afterAyah={viewer === "self" ? (a, s) => <VerseNoteMarker surah={s} ayah={a} /> : undefined}
        />
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle} style={{ margin: "0 0 8px" }}>
          <span>{adult ? `أهداف ${childName} لكل مقطع` : "أهدافي لكل مقطع"}</span>
          {!editingTargets && canTargets && (
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
                const r = await setTargetsAction(t, subjectId);
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
          <div className={styles.empty}>{canAdd && !adult ? <>لا توجد مقاطع قيد الحفظ — {p("ابدأ", "ابدئي")} بإضافة مقطع جديد.</> : "لا توجد مقاطع قيد الحفظ."}</div>
        </div>
      ) : (
        <div className={styles.cards} style={{ marginBottom: 14 }}>
          {log.active.map((s) => (
            <SegmentCard key={s.id} s={s} g={g} href={canAdd ? `${base}/${s.id}` : undefined} recitedLabel={recited} />
          ))}
        </div>
      )}

      {log.past.length > 0 && (
        <>
          <div className={styles.sectionTitle}>مقاطع سابقة</div>
          <div className={styles.cards}>
            {log.past.map((s) => (
              <SegmentCard key={s.id} s={s} g={g} href={`${base}/${s.id}`} recitedLabel={recited} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
