"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/(dashboard)/students/[id]/detail.module.css";
import info from "@/components/student-info/student-info.module.css";
import { InfoFieldsInputs } from "@/components/student-info/InfoFieldsInputs";
import { StudentInfoList } from "@/components/student-info/StudentInfoList";
import {
  fieldLabel,
  isMultilineField,
  isPhoneField,
  missingRequiredCount,
  type InfoField,
} from "@/lib/students/extra-info-rules";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { saveParentStudentInfoAction } from "./actions";

// «معلومات الطالب/ة» in the parent portal: the fields the course shows to
// parents, which the parent fills/edits directly. The server re-checks
// everything (saveParentStudentInfoAction).
export function ParentStudentInfo({
  fields,
  values,
  groupGender: g,
}: {
  fields: InfoField[];
  values: Record<string, string>;
  groupGender: GroupGender;
}) {
  const router = useRouter();
  const missing = missingRequiredCount(fields, values);
  const filled = fields.filter((f) => values[f.id]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const title = `معلومات ${pickByGroup(g, { m: "الطالب", f: "الطالبة" })}`;

  function open() {
    setDraft(values);
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveParentStudentInfoAction(draft);
      if (result.error) return setError(result.error);
      setEditing(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <>
      <div className={styles.secTitle}>
        <span className={styles.dot} /> 🗂 {title}
      </div>
      <div className={styles.card}>
        {editing ? (
          <>
            <InfoFieldsInputs
              fields={fields}
              values={draft}
              onChange={(id, value) => setDraft((prev) => ({ ...prev, [id]: value }))}
              groupGender={g}
              classes={{ field: info.formField, input: info.formInput }}
              idPrefix="parent-info"
              title={null}
            />
            {error && <div className={info.formError}>{error}</div>}
            <div className={info.formButtons}>
              <button type="button" className={info.formPrimary} onClick={save} disabled={pending}>
                {pending ? "جارٍ الحفظ…" : "حفظ"}
              </button>
              <button type="button" className={info.formGhost} onClick={() => setEditing(false)} disabled={pending}>
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <>
            {missing > 0 && (
              <div className={info.formHint}>توجد معلومات مطلوبة لم تُعبَّأ بعد، يُرجى إكمالها.</div>
            )}
            {filled.length === 0 ? (
              <div className={styles.logEmpty}>لم تُعبَّأ أي معلومات بعد.</div>
            ) : (
              <StudentInfoList
                bare
                title={title}
                items={filled.map((f) => ({
                  id: f.id,
                  label: fieldLabel(f, g),
                  value: values[f.id],
                  phone: isPhoneField(f),
                  multiline: isMultilineField(f),
                }))}
              />
            )}
            {saved && <div className={info.formSaved}>تم حفظ المعلومات ✓</div>}
            <div className={info.formButtons}>
              <button type="button" className={info.formPrimary} onClick={open}>
                ✎ تعديل المعلومات
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
