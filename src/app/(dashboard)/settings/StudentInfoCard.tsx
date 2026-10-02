"use client";

import { useRef, useState, useTransition } from "react";
import styles from "./settings.module.css";
import {
  addCustomInfoFieldAction,
  deleteCustomInfoFieldAction,
  moveInfoFieldAction,
  renameCustomInfoFieldAction,
  setInfoFieldFlagAction,
  setParentStudentInfoEditAction,
  setStudentInfoEnabledAction,
  type InfoFieldFlag,
} from "./actions";
import { MAX_CUSTOM_FIELDS, MAX_LABEL_LENGTH, fieldLabel, type InfoField } from "@/lib/students/extra-info-rules";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";

const STUDENT = <span className={styles.nowrap}>الطالب/ة</span>;

const FLAGS: { flag: InfoFieldFlag; label: string }[] = [
  { flag: "enabled", label: "مفعّل" },
  { flag: "required", label: "إلزامي" },
  { flag: "visibleToTeachers", label: "يظهر للمعلمين" },
  { flag: "visibleToParents", label: "يظهر لوليّ الأمر" },
];

export function StudentInfoCard({
  enabled,
  parentEdit,
  fields,
  adminGender,
}: {
  enabled: boolean;
  parentEdit: boolean;
  fields: InfoField[];
  adminGender: PersonGender;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ fieldId: string; count: number } | null>(null);
  const newLabelRef = useRef<HTMLInputElement>(null);
  const customCount = fields.filter((f) => f.builtinKey === null).length;

  function run(action: () => Promise<{ error?: string } | void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else after?.();
    });
  }

  function commitRename(field: InfoField, value: string) {
    if (value.trim() === (field.label ?? "") || !value.trim()) return;
    run(() => renameCustomInfoFieldAction(field.id, value));
  }

  function remove(fieldId: string, confirmed = false) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomInfoFieldAction(fieldId, confirmed);
      if (result.error) setError(result.error);
      else if (result.valuesToDelete) setDeleting({ fieldId, count: result.valuesToDelete });
      else setDeleting(null);
    });
  }

  function add() {
    const label = newLabelRef.current?.value ?? "";
    if (!label.trim()) return;
    run(
      () => addCustomInfoFieldAction(label),
      () => {
        if (newLabelRef.current) newLabelRef.current.value = "";
      },
    );
  }

  const deletingField = deleting ? fields.find((f) => f.id === deleting.fieldId) : null;

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>معلومات إضافية عن {STUDENT}</div>
          <div className={styles.settingDesc}>
            حقول اختيارية تُجمع لكل <span className={styles.nowrap}>طالب/ة</span>، مثل بيانات الوالدين ورقم الهاتف ومكان الدراسة أو العمل، إضافةً إلى حقول خاصة
            بالدورة. تظهر في صفحة {STUDENT} وفي نموذج الإضافة والتعديل وفي قالب الاستيراد. ولا تظهر للطلاب أنفسهم. عند
            الإيقاف تُخفى المعلومات كلها وتبقى محفوظة.
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${enabled ? styles.sel : ""}`}
            onClick={() => !enabled && !pending && run(() => setStudentInfoEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`}
            onClick={() => enabled && !pending && run(() => setStudentInfoEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>

      {enabled && (
        <>
          <div className={styles.settingRow}>
            <div className={styles.settingText}>
              <div className={styles.settingTitle}>تعبئة وليّ الأمر للمعلومات</div>
              <div className={styles.settingDesc}>
                يظهر لوليّ الأمر في صفحة المتابعة قسم «معلومات {STUDENT}» بالحقول المفعّلة التي تظهر له، فيعبّئها ويعدّلها،
                وتُحفظ التعديلات مباشرةً دون حاجة إلى اعتماد.
              </div>
            </div>
            <div className={styles.optionPills}>
              <div
                className={`${styles.optionPill} ${parentEdit ? styles.sel : ""}`}
                onClick={() => !parentEdit && !pending && run(() => setParentStudentInfoEditAction(true))}
              >
                مفعّل
              </div>
              <div
                className={`${styles.optionPill} ${!parentEdit ? styles.sel : ""}`}
                onClick={() => parentEdit && !pending && run(() => setParentStudentInfoEditAction(false))}
              >
                غير مفعّل
              </div>
            </div>
          </div>

          <div className={styles.settingRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className={styles.settingText}>
              <div className={styles.settingTitle}>الحقول</div>
              <div className={styles.settingDesc}>
                {pickByPerson(adminGender, { m: "يرى المشرف", f: "ترى المشرفة" })} كل الحقول المفعّلة دائمًا. يرى المعلمون الحقول التي «تظهر للمعلمين»، ويعدّلونها إذا كانت صلاحية
                «تعديل بيانات الطلاب» لكل المعلمين. الحقل الإلزامي يُطلب عند الإضافة والتعديل فقط؛ ومن لم تُعبَّأ معلوماته
                الإلزامية تظهر في صفحته علامة «معلومات ناقصة». إيقاف الحقل يخفيه ويُبقي قيمه محفوظة.
              </div>
            </div>

            <div className={styles.editList} style={{ marginTop: 12 }}>
              {fields.map((f, i) => (
                <div className={`${styles.infoFieldRow} ${f.enabled ? "" : styles.infoFieldOff}`} key={f.id}>
                  <div className={styles.infoFieldName}>
                    {f.builtinKey ? (
                      <span>{fieldLabel(f, null)}</span>
                    ) : (
                      <input
                        type="text"
                        maxLength={MAX_LABEL_LENGTH}
                        defaultValue={f.label ?? ""}
                        aria-label="اسم الحقل"
                        onBlur={(e) => commitRename(f, e.target.value)}
                      />
                    )}
                  </div>
                  <div className={styles.infoFlags}>
                    {FLAGS.map(({ flag, label }) => {
                      const on = f[flag];
                      // the other switches mean nothing while the field is off
                      const inactive = flag !== "enabled" && !f.enabled;
                      return (
                        <button
                          key={flag}
                          type="button"
                          aria-pressed={on}
                          disabled={pending || inactive}
                          className={`${styles.infoFlag} ${on ? styles.infoFlagOn : ""}`}
                          onClick={() => run(() => setInfoFieldFlagAction(f.id, flag, !on))}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.infoFieldTools}>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      title="نقل إلى الأعلى"
                      aria-label="نقل إلى الأعلى"
                      disabled={pending || i === 0}
                      onClick={() => run(() => moveInfoFieldAction(f.id, "up"))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      title="نقل إلى الأسفل"
                      aria-label="نقل إلى الأسفل"
                      disabled={pending || i === fields.length - 1}
                      onClick={() => run(() => moveInfoFieldAction(f.id, "down"))}
                    >
                      ↓
                    </button>
                    {f.builtinKey === null && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        title="حذف الحقل"
                        aria-label="حذف الحقل"
                        disabled={pending}
                        onClick={() => remove(f.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {deleting && deletingField && (
              <div className={styles.assignBox} style={{ marginBottom: 12 }}>
                <div className={styles.aTitle}>
                  في حقل «{deletingField.label}» قيم محفوظة (عدد الطلاب: {deleting.count}، بمن فيهم من في الأرشيف). سيؤدي
                  الحذف إلى حذف هذه القيم نهائيًّا، ولا يمكن التراجع عنه. أما إيقاف الحقل فيخفيه ويُبقي قيمه.
                </div>
                <div className={styles.editRow}>
                  <button
                    className={styles.addBtn}
                    style={{ padding: "8px 14px" }}
                    type="button"
                    disabled={pending}
                    onClick={() => remove(deleting.fieldId, true)}
                  >
                    حذف الحقل وقيمه
                  </button>
                  <button className={styles.copyBtn} style={{ marginTop: 0 }} type="button" onClick={() => setDeleting(null)}>
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {customCount < MAX_CUSTOM_FIELDS ? (
              <div className={styles.addNewRow}>
                <input
                  ref={newLabelRef}
                  className={styles.infoNewInput}
                  type="text"
                  maxLength={MAX_LABEL_LENGTH}
                  placeholder="اسم حقل خاص جديد، مثل: ملاحظات صحية"
                  onKeyDown={(e) => e.key === "Enter" && add()}
                />
                <button className={styles.addBtn} onClick={add} type="button" disabled={pending}>
                  إضافة حقل
                </button>
              </div>
            ) : (
              <div className={styles.settingDesc}>بلغت الحقول الخاصة الحدّ الأقصى ({MAX_CUSTOM_FIELDS} حقلًا).</div>
            )}
          </div>
        </>
      )}
      {error && <div className={styles.err}>{error}</div>}
    </>
  );
}
