"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/plan/plan.module.css";
import hl from "@/components/home-log/home-log.module.css";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { PriorPicker, usePriorState, type PriorPickerWords } from "@/components/plan/PriorPicker";
import { templateSurahs, type TemplateKey } from "@/lib/students/new-student";
import { localToday } from "@/lib/home-log/rules";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import { addPriorAction, removeGoalAction, saveGoalAction, savePlanAction } from "../actions";
import { GoalEditor } from "@/components/goal/GoalEditor";
import { useToday } from "@/lib/calendar/useToday";
import { LeaveGuard } from "@/components/leave-guard/LeaveGuard";
import type { GoalSpec } from "@/lib/goals/goal";
import { useGuideTarget } from "@/components/guide/targets";

// Her plan: set up the first time (with memorization from before), and
// changed whenever she likes afterwards. «العائلة»: an adult with edit rights
// on a child's plan (subjectId + child: the wording is about the child; the
// goal only while the child's «الهدف» switch is on).
export function PlanView({
  gender,
  initialTemplate,
  initialPlan,
  goal = null,
  subjectId,
  child,
  goalEnabled = true,
}: {
  gender: PersonGender;
  // null the first time
  initialTemplate: TemplateKey | null;
  initialPlan: number[];
  // her memorization goal (lib/goals/goal.ts), or null
  goal?: GoalSpec | null;
  subjectId?: string;
  child?: { name: string; gender: "MALE" | "FEMALE" };
  goalEnabled?: boolean;
}) {
  // about the child (an adult's view) or «you»
  const c = (m: string, f: string) => (child?.gender === "FEMALE" ? f : m);
  const router = useRouter();
  const t = useGuideTarget();
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
  const [unchangedHint, setUnchangedHint] = useState(false);
  const today = useToday();

  const priorWords: PriorPickerWords = child
    ? {
        none: "لا يوجد حفظ سابق",
        yes: `نعم، ${c("حفظ", "حفظت")} أجزاءً من قبل`,
        planOf: `خطة ${child.name}`,
        choose: p("اختر", "اختاري"),
        partialWho: c("يحفظ منها", "تحفظ منها"),
      }
    : {
        none: "لا يوجد حفظ سابق",
        yes: "نعم، حفظتُ أجزاءً من قبل",
        planOf: "خطتك",
        choose: p("اختر", "اختاري"),
        partialWho: p("تحفظ منها", "تحفظين منها"),
      };
  const changed = firstTime || template !== initialTemplate || plan.join(",") !== initialPlan.join(",");
  // an existing plan edited here and not saved yet
  const unsaved = !firstTime && changed;

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    setPlan(templateSurahs(key));
  }

  // back to the saved plan
  function discard() {
    if (initialTemplate) setTemplate(initialTemplate);
    setPlan(initialPlan);
    setError(null);
    setOk(null);
  }

  function savePlan() {
    setError(null);
    setOk(null);
    // «حفظ الخطة» never looks dead: with nothing changed it says so
    if (!changed) return setUnchangedHint(true);
    setUnchangedHint(false);
    startTransition(async () => {
      const r = await savePlanAction({
        template,
        plan,
        // a range picked but not applied counts as applied
        prior: firstTime ? prior.value({ pendingRangeOf: plan }) : undefined,
        today: localToday(),
        subjectId,
      });
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
      const r = await addPriorAction({ prior: addPrior.value({ always: true, pendingRangeOf: initialPlan }), today: localToday(), subjectId });
      if (r.error) return setPriorError(r.error);
      addPrior.reset();
      addPrior.setRangeFrom(null);
      addPrior.setRangeTo(null);
      setPriorOk("تمت إضافة الحفظ السابق ✓");
      router.refresh();
    });
  }

  return (
    <div>
      <h1 className={styles.secTitle} style={{ fontSize: 17, color: "var(--ink)", marginTop: 0 }}>
        {child ? `خطة ${child.name}` : firstTime ? "إعداد خطة الحفظ" : "خطتي"}
      </h1>
      <p style={{ margin: "0 4px 4px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
        {child
          ? `${p("يمكنك", "يمكنكِ")} تغيير خطة ${child.name} في أي وقت. ما ${c("حفظه", "حفظته")} يبقى محفوظًا، ويُحسب ${c("موضعه", "موضعها")} من جديد حسب ترتيب الخطة الجديدة.`
          : firstTime
          ? `${p("اختر", "اختاري")} قالبًا لخطتك ثم ${p("رتّب", "رتّبي")} السور كما ${p("تشاء", "تشائين")}. ${p("يمكنك", "يمكنكِ")} تغيير الخطة في أي وقت لاحقًا.`
          : `${p("يمكنك", "يمكنكِ")} تغيير خطتك في أي وقت. ما ${p("حفظتَه", "حفظتِه")} يبقى محفوظًا، ويُحسب موضعك من جديد حسب ترتيب الخطة الجديدة.`}
      </p>

      <PlanEditor
        template={template}
        plan={plan}
        onTemplate={applyTemplate}
        onPlanChange={setPlan}
        words={{ juzAmmaStarts: p("تبدأ", "تبدئين"), add: p("أضف", "أضيفي") }}
        live={{ inPlan: child ? `هذه السورة موجودة في خطة ${child.name}.` : `هذه السورة موجودة في ${p("خطتك", "خطتكِ")}.` }}
      />

      {firstTime && (
        <>
          <div className={styles.secTitle}>
            <span className={styles.dot} /> الحفظ السابق
          </div>
          <div className={styles.card} {...t("plan.prior")}>
            <PriorPicker plan={plan} prior={prior} words={priorWords} />
          </div>
        </>
      )}

      {error && <div className={styles.err}>{error}</div>}
      {ok && <div style={{ color: "var(--sage-deep)", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{ok}</div>}
      {unchangedHint && !changed && (
        <div className={styles.err} role="status">
          لم {p("تغيّر", "تغيّري")} شيئًا في الخطة بعد.
        </div>
      )}
      <button className={styles.saveBtn} onClick={savePlan} disabled={pending} type="button" {...t("plan.save")}>
        {pending ? "جارٍ الحفظ..." : firstTime ? "حفظ الخطة والبدء" : "حفظ الخطة"}
      </button>
      {unsaved && (
        <button className={hl.ghostBtn} style={{ width: "100%", marginTop: 10 }} onClick={discard} disabled={pending} type="button" {...t("plan.discard")}>
          إلغاء التغييرات
        </button>
      )}
      <LeaveGuard
        you={gender}
        dirty={unsaved}
        dirtyNote={`لم تُحفظ التغييرات على الخطة بعد — ${p("اضغط", "اضغطي")} «حفظ الخطة» أو «إلغاء التغييرات»، أو ${p("اضغط", "اضغطي")} الرابط مرة أخرى للمغادرة دونها.`}
      />

      {!firstTime && goalEnabled && (
        <div className={styles.card} style={{ marginTop: 24 }}>
          <GoalEditor
            plan={initialPlan}
            current={goal}
            today={today}
            hint={`يُحسب المطلوب يوميًا تلقائيًا من المتبقي حتى الموعد، وكل أيام الأسبوع محسوبة. ما ${child ? `${c("حفظه", "حفظته")} ${child.name}` : p("حفظتَه", "حفظتِه")} قبل وضع الهدف هو نقطة البداية.`}
            onSave={async (input) => {
              const r = await saveGoalAction({ goal: input, today: localToday(), subjectId });
              if (!r.error) router.refresh();
              return r;
            }}
            onRemove={async () => {
              const r = await removeGoalAction(subjectId);
              if (!r.error) router.refresh();
              return r;
            }}
          />
        </div>
      )}

      {!firstTime && (
        <>
          <div className={styles.secTitle} style={{ marginTop: 30 }}>
            <span className={styles.dot} /> إضافة حفظ سابق
          </div>
          <div className={styles.card} {...t("plan.prior")}>
            <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
              {child ? (
                <>
                  {p("أضف", "أضيفي")} هنا ما {c("حفظه", "حفظته")} {child.name} من قبل؛ يُحسب في {c("موضعه", "موضعها")} و{c("صفحاته", "صفحاتها")} المحفوظة، ويظهر في
                  السجلّ بعنوان «حفظ سابق».
                </>
              ) : (
                <>
                  {p("أضف", "أضيفي")} هنا ما {p("حفظتَه", "حفظتِه")} قبل البدء في رفيق الحفظ؛ يُحسب في موضعك وصفحاتك المحفوظة،
                  ويظهر في السجلّ بعنوان «حفظ سابق».
                </>
              )}
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
