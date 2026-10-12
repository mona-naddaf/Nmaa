"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./detail.module.css";
import rs from "@/components/recitation/recitation.module.css";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { JUZ_DIRECTION_LABEL, type JuzDirection } from "@/lib/recitation/juz-direction";
import { templateSurahs, type TemplateKey } from "@/lib/students/new-student";
import { imperative, pickByGroup, studentNounDef, type GroupGender, type PersonGender } from "@/lib/text/gender";
import { saveStudentPlanAction, setJuzDirectionAction } from "./plan-actions";

// «خطة الحفظ» on the student page: her plan, the direction of each juz in an
// untouched «ترتيب المصحف بالعكس», and — with «تعديل خطة الحفظ» — changing
// either (plan-actions.ts checks everything again).

export interface JuzDirectionRow {
  juz: number;
  // its first and last surah, in Mushaf order
  first: string;
  last: string;
  direction: JuzDirection | null;
  manual: boolean;
  // she has memorized something in it
  started: boolean;
}

export function PlanPanel({
  studentId,
  groupGender,
  viewerGender,
  templateKey,
  templateLabel,
  storedPlan,
  juzRows,
  editedReverse,
  canEdit,
}: {
  studentId: string;
  groupGender: GroupGender;
  viewerGender: PersonGender;
  templateKey: TemplateKey;
  templateLabel: string;
  storedPlan: number[];
  // null when the plan has no juz directions
  juzRows: JuzDirectionRow[] | null;
  // a reverse plan whose order was edited by hand (so no directions)
  editedReverse: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>(templateKey);
  const [plan, setPlan] = useState<number[]>(storedPlan);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const g = groupGender;
  const herPlan = pickByGroup(g, { m: "خطته", f: "خطتها" });

  function openEditor() {
    setTemplate(templateKey);
    setPlan(storedPlan);
    setError(null);
    setEditing(true);
  }

  function savePlan() {
    setError(null);
    startTransition(async () => {
      const result = await saveStudentPlanAction(studentId, { template, plan });
      if ("error" in result) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  function setDirection(juz: number, direction: JuzDirection) {
    setError(null);
    startTransition(async () => {
      const result = await setJuzDirectionAction(studentId, juz, direction);
      if ("error" in result) return setError(result.error);
      router.refresh();
    });
  }

  // the juz she has started or that have a direction; the rest on demand
  const shown = juzRows && (showAll ? juzRows : juzRows.filter((r) => r.started || r.direction));

  return (
    <div className={styles.card}>
      <div className={styles.planSummary}>
        قالب الخطة: <strong>{templateLabel}</strong> · {storedPlan.length} سورة
      </div>
      {editedReverse && (
        <p className={styles.priorHint}>رُتّبت هذه الخطة يدويًا، فتُتّبع كما هي دون اتجاه للأجزاء.</p>
      )}

      {shown && (
        <>
          <p className={styles.priorHint}>
            تُحفظ الأجزاء من الجزء 30 إلى الجزء 1، ولكل جزء اتجاه: «من أوله» (أول سورة فيه أولًا) أو «من آخره» (آخر سورة فيه أولًا).
            يُعتمد الاتجاه تلقائيًا من أول تسميع جديد في الجزء، وما لم يُحدَّد يُعامل «من آخره». التصحيح اليدوي لا يغيّره أي تحديد تلقائي.
          </p>
          {shown.length === 0 && (
            <p className={styles.priorHint}>لم {pickByGroup(g, { m: "يبدأ", f: "تبدأ" })} {studentNounDef(g)} أي جزء بعد.</p>
          )}
          <div className={styles.juzList}>
            {shown.map((r) => (
              <div className={styles.juzRow} key={r.juz}>
                <div className={styles.juzName}>
                  الجزء {r.juz}
                  <span className={styles.juzSurahs}>
                    {r.first} — {r.last}
                  </span>
                </div>
                <div className={styles.juzState}>
                  {r.direction
                    ? `${JUZ_DIRECTION_LABEL[r.direction]} · ${r.manual ? "يدويًا" : "تلقائيًا"}`
                    : "غير محدد (يُعامل «من آخره»)"}
                </div>
                {canEdit && (
                  <div className={styles.juzBtns}>
                    {(["FROM_START", "FROM_END"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`${styles.juzPill} ${r.direction === d ? styles.sel : ""}`}
                        disabled={pending || (r.direction === d && r.manual)}
                        onClick={() => setDirection(r.juz, d)}
                      >
                        {JUZ_DIRECTION_LABEL[d]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {juzRows && juzRows.length > shown.length && (
            <button type="button" className={styles.linkBtn} onClick={() => setShowAll(true)}>
              عرض كل الأجزاء ({juzRows.length})
            </button>
          )}
        </>
      )}

      {error && <div className={styles.err}>{error}</div>}

      {canEdit && !editing && (
        <div className={styles.priorActions}>
          <button type="button" className={styles.linkBtn} onClick={openEditor}>
            تعديل الخطة
          </button>
        </div>
      )}

      {canEdit && editing && (
        <>
          <PlanEditor
            template={template}
            plan={plan}
            onTemplate={(key) => {
              setTemplate(key);
              setPlan(templateSurahs(key));
            }}
            onPlanChange={(update) => setPlan(update)}
            words={{
              juzAmmaStarts: `${pickByGroup(g, { m: "يبدأ", f: "تبدأ" })} ${studentNounDef(g)}`,
              add: imperative(viewerGender, { m: "أضف", f: "أضيفي" }),
            }}
          />
          <p className={styles.priorHint}>
            تغيير الخطة لا يحذف أي تسميع: يُعاد حساب الموضع والفجوات من التسميع المسجَّل. أما الفجوات التي اعتُمدت قبل التغيير فلا
            تُحتسب بعده. ولا اتجاه للأجزاء إلا في «ترتيب المصحف بالعكس» دون تعديل على ترتيبه.
          </p>
          <div className={styles.priorActions}>
            <button className={rs.saveBtn} onClick={savePlan} disabled={pending} type="button">
              {pending ? "جارٍ الحفظ..." : `حفظ ${herPlan}`}
            </button>
            <button className={styles.linkBtn} onClick={() => setEditing(false)} disabled={pending} type="button">
              إلغاء
            </button>
          </div>
        </>
      )}
    </div>
  );
}
