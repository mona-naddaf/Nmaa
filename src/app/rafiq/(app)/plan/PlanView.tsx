"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/plan/plan.module.css";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { PriorPicker, usePriorState, type PriorPickerWords } from "@/components/plan/PriorPicker";
import { templateSurahs, type TemplateKey } from "@/lib/students/new-student";
import { localToday } from "@/lib/home-log/rules";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { addPriorAction, savePlanAction } from "../actions";

// Her plan: set up the first time (with memorization from before), and
// changed whenever she likes afterwards.
export function PlanView({
  gender,
  initialTemplate,
  initialPlan,
}: {
  gender: PersonGender;
  // null the first time
  initialTemplate: TemplateKey | null;
  initialPlan: number[];
}) {
  const router = useRouter();
  const p = (m: string, f: string) => pickByPerson(gender, { m, f });
  const firstTime = initialTemplate === null;
  const [template, setTemplate] = useState<TemplateKey>(initialTemplate ?? "mushafrev");
  const [plan, setPlan] = useState<number[]>(firstTime ? templateSurahs("mushafrev") : initialPlan);
  const prior = usePriorState();
  const addPrior = usePriorState();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [priorError, setPriorError] = useState<string | null>(null);
  const [priorOk, setPriorOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priorWords: PriorPickerWords = {
    none: "لا يوجد حفظ سابق",
    yes: "نعم، حفظتُ أجزاءً من قبل",
    planOf: "خطتك",
    choose: p("اختر", "اختاري"),
    partialWho: p("تحفظ منها", "تحفظين منها"),
  };
  const changed = firstTime || template !== initialTemplate || plan.join(",") !== initialPlan.join(",");

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    setPlan(templateSurahs(key));
  }

  function savePlan() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const r = await savePlanAction({ template, plan, prior: firstTime ? prior.value() : undefined, today: localToday() });
      if (r.error) return setError(r.error);
      if (firstTime) router.push("/rafiq");
      else {
        setOk("تم حفظ الخطة ✓");
        router.refresh();
      }
    });
  }

  function savePrior() {
    setPriorError(null);
    setPriorOk(null);
    startTransition(async () => {
      const r = await addPriorAction({ prior: addPrior.value({ always: true }), today: localToday() });
      if (r.error) return setPriorError(r.error);
      addPrior.reset();
      setPriorOk("تمت إضافة الحفظ السابق ✓");
      router.refresh();
    });
  }

  return (
    <div>
      <h1 className={styles.secTitle} style={{ fontSize: 17, color: "var(--ink)", marginTop: 0 }}>
        {firstTime ? "إعداد خطة الحفظ" : "خطتي"}
      </h1>
      <p style={{ margin: "0 4px 4px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
        {firstTime
          ? `${p("اختر", "اختاري")} قالبًا لخطتك ثم ${p("رتّب", "رتّبي")} السور كما ${p("تشاء", "تشائين")}. ${p("يمكنك", "يمكنكِ")} تغيير الخطة في أي وقت لاحقًا.`
          : `${p("يمكنك", "يمكنكِ")} تغيير خطتك في أي وقت. ما ${p("حفظتَه", "حفظتِه")} يبقى محفوظًا، ويُحسب موضعك من جديد حسب ترتيب الخطة الجديدة.`}
      </p>

      <PlanEditor
        template={template}
        plan={plan}
        onTemplate={applyTemplate}
        onPlanChange={setPlan}
        words={{ juzAmmaStarts: p("تبدأ", "تبدئين"), add: p("أضف", "أضيفي") }}
      />

      {firstTime && (
        <>
          <div className={styles.secTitle}>
            <span className={styles.dot} /> الحفظ السابق
          </div>
          <div className={styles.card}>
            <PriorPicker plan={plan} prior={prior} words={priorWords} />
          </div>
        </>
      )}

      {error && <div className={styles.err}>{error}</div>}
      {ok && <div style={{ color: "var(--sage-deep)", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{ok}</div>}
      <button className={styles.saveBtn} onClick={savePlan} disabled={pending || !changed} type="button">
        {pending ? "جارٍ الحفظ..." : firstTime ? "حفظ الخطة والبدء" : "حفظ الخطة"}
      </button>

      {!firstTime && (
        <>
          <div className={styles.secTitle} style={{ marginTop: 30 }}>
            <span className={styles.dot} /> إضافة حفظ سابق
          </div>
          <div className={styles.card}>
            <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
              {p("أضف", "أضيفي")} هنا ما {p("حفظتَه", "حفظتِه")} قبل البدء في رفيق الحفظ؛ يُحسب في موضعك وصفحاتك المحفوظة،
              ويظهر في السجلّ بعنوان «حفظ سابق».
            </p>
            <PriorPicker plan={initialPlan} prior={addPrior} words={priorWords} alwaysOpen />
            {priorError && <div className={styles.err} style={{ marginTop: 12 }}>{priorError}</div>}
            {priorOk && <div style={{ color: "var(--sage-deep)", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{priorOk}</div>}
            <button className={styles.saveBtn} style={{ marginTop: 14 }} onClick={savePrior} disabled={pending} type="button">
              إضافة إلى المحفوظ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
