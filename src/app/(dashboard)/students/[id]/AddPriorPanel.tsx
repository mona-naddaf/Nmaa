"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./detail.module.css";
import rs from "@/components/recitation/recitation.module.css";
import { PriorPicker, usePriorState } from "@/components/plan/PriorPicker";
import { imperative, pickByGroup, studentNounDef, type GroupGender, type PersonGender } from "@/lib/text/gender";
import { addStudentPriorAction } from "./prior-actions";

// «+ إضافة حفظ سابق» on the student page, opened from the position card: the
// same picker as the add-student form, saved as the same PRIOR rows.

export function AddPriorPanel({
  studentId,
  plan,
  groupGender,
  viewerGender,
  onClose,
  onSaved,
}: {
  studentId: string;
  plan: number[];
  groupGender: GroupGender;
  viewerGender: PersonGender;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const prior = usePriorState();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await addStudentPriorAction(studentId, prior.value({ always: true }));
      if ("error" in result) return setError(result.error);
      prior.reset();
      router.refresh();
      onSaved();
    });
  }

  return (
    <>
      <div className={styles.secTitle} id="addPrior">
        <span className={styles.dot} /> إضافة حفظ سابق
      </div>
      <div className={styles.card}>
        <p className={styles.priorHint}>
          {pickByGroup(groupGender, {
            m: "ما حفظه الطالب خارج الدورة: نُسي عند إضافته، أو درس في مكان آخر ثم عاد.",
            f: "ما حفظته الطالبة خارج الدورة: نُسي عند إضافتها، أو درست في مكان آخر ثم عادت.",
          })}{" "}
          يُحسب في الموضع وأشرطة التقدّم، ولا يضيف نقاطًا ولا يظهر في لوحة الإنجاز، ويظهر في السجل بعنوان «حفظ سابق».
        </p>
        <PriorPicker
          plan={plan}
          prior={prior}
          alwaysOpen
          words={{
            none: "",
            yes: "",
            planOf: `خطة ${studentNounDef(groupGender)}`,
            choose: imperative(viewerGender, { m: "اختر", f: "اختاري" }),
            partialWho: `${pickByGroup(groupGender, { m: "يحفظ", f: "تحفظ" })} منها ${studentNounDef(groupGender)}`,
          }}
        />
        {error && <div className={styles.err}>{error}</div>}
        <div className={styles.priorActions}>
          <button className={rs.saveBtn} onClick={save} disabled={pending} type="button">
            {pending ? "جارٍ الحفظ..." : "حفظ الحفظ السابق"}
          </button>
          <button className={styles.linkBtn} onClick={onClose} disabled={pending} type="button">
            إلغاء
          </button>
        </div>
      </div>
    </>
  );
}
