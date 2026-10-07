"use client";

import { useState, useTransition } from "react";
import styles from "@/components/plan/plan.module.css";
import { createStudentAction } from "./actions";
import { MUSHAF_REVERSE_ORDER } from "@/lib/quran-data";
import { PlanEditor, templateSurahs, type TemplateKey } from "@/components/plan/PlanEditor";
import { PriorPicker, usePriorState } from "@/components/plan/PriorPicker";
import {
  studentNounDef,
  pickByGroup,
  imperative,
  type GroupGender,
  type PersonGender,
} from "@/lib/text/gender";

import { InfoFieldsInputs } from "@/components/student-info/InfoFieldsInputs";
import type { InfoField } from "@/lib/students/extra-info-rules";

export function NewStudentForm({
  groups,
  viewerGender,
  infoFields,
}: {
  groups: { id: string; name: string; gender: GroupGender }[];
  viewerGender: PersonGender;
  // the extra-info fields the viewer may fill
  infoFields: InfoField[];
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [info, setInfo] = useState<Record<string, string>>({});
  const selectedGender: GroupGender = groups.find((g) => g.id === groupId)?.gender ?? "MIXED";
  const [template, setTemplate] = useState<TemplateKey>("mushafrev");
  const [plan, setPlan] = useState<number[]>(MUSHAF_REVERSE_ORDER);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const prior = usePriorState();

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    setPlan(templateSurahs(key));
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("age", age);
    formData.set("grade", grade);
    formData.set("groupId", groupId);
    formData.set("info", JSON.stringify(info));
    formData.set("template", template);
    formData.set("plan", JSON.stringify(plan));
    const { completedSurahs, partial } = prior.value();
    formData.set("priorCompletedSurahs", JSON.stringify(completedSurahs));
    formData.set("priorPartial", partial ? JSON.stringify(partial) : "");
    startTransition(async () => {
      const result = await createStudentAction(null, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> بيانات {studentNounDef(selectedGender)}
      </div>
      <div className={styles.card}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="girlName">اسم {studentNounDef(selectedGender)}</label>
            <input id="girlName" type="text" placeholder="مثال: سارة خالد" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="girlAge">العمر</label>
            <input id="girlAge" type="number" placeholder="مثال: 10" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="girlGrade">الصف (اختياري)</label>
            <input id="girlGrade" type="text" placeholder="مثال: الخامس" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
        </div>
        <div className={styles.field}>
          <label>المجموعة</label>
          <div className={styles.groupPills}>
            {groups.map((g) => (
              <div
                key={g.id}
                className={`${styles.groupPill} ${groupId === g.id ? styles.sel : ""}`}
                onClick={() => setGroupId(g.id)}
              >
                {g.name}
              </div>
            ))}
          </div>
        </div>
        <InfoFieldsInputs
          fields={infoFields}
          values={info}
          onChange={(id, value) => setInfo((prev) => ({ ...prev, [id]: value }))}
          groupGender={selectedGender}
          classes={{ field: styles.infoField, input: "" }}
          idPrefix="new-info"
        />
      </div>

      <PlanEditor
        template={template}
        plan={plan}
        onTemplate={applyTemplate}
        onPlanChange={setPlan}
        words={{
          juzAmmaStarts: `${pickByGroup(selectedGender, { m: "يبدأ", f: "تبدأ" })} ${studentNounDef(selectedGender)}`,
          add: imperative(viewerGender, { m: "أضف", f: "أضيفي" }),
        }}
      />

      <div className={styles.secTitle}>
        <span className={styles.dot} /> الحفظ السابق (قبل الانضمام)
      </div>
      <div className={styles.card}>
        <PriorPicker
          plan={plan}
          prior={prior}
          words={{
            none: "لا يوجد حفظ سابق",
            yes: "نعم، حفظت أجزاءً قبل الانضمام",
            planOf: `خطة ${studentNounDef(selectedGender)}`,
            choose: imperative(viewerGender, { m: "اختر", f: "اختاري" }),
            partialWho: `${pickByGroup(selectedGender, { m: "يحفظ", f: "تحفظ" })} منها ${studentNounDef(selectedGender)}`,
          }}
        />
      </div>

      {error && <div className={styles.err}>{error}</div>}
      <button className={styles.saveBtn} onClick={submit} disabled={pending} type="button">
        {pending ? "جارٍ الحفظ..." : `حفظ ${studentNounDef(selectedGender)} والخطة`}
      </button>
      <div className={styles.note}>يمكن اختيار قالب جاهز كبداية، ثم إعادة ترتيب السور أو حذف/إضافة أي سورة يدويًا قبل الحفظ</div>
    </div>
  );
}
