"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./manage.module.css";
import { archiveStudentAction, updateStudentAction } from "./manage-actions";
import { pickByGroup, studentNoun, studentNounDef, type GroupGender } from "@/lib/text/gender";
import { InfoFieldsInputs } from "@/components/student-info/InfoFieldsInputs";
import type { InfoField } from "@/lib/students/extra-info-rules";

type Group = { id: string; name: string; gender: GroupGender };

const GENDER_LABEL: Record<GroupGender, string> = { GIRLS: "بنات", BOYS: "بنين", MIXED: "مختلطة" };

// "تعديل البيانات" and "أرشفة" on a student's page. Shown only when the
// viewer may do them; the server actions check again either way.
export function StudentManageBar({
  student,
  groups,
  canEdit,
  canArchive,
  infoFields = [],
  infoValues = {},
}: {
  student: { id: string; name: string; age: number; grade: string | null; groupId: string };
  // the groups the viewer may move the student into (assigned-groups rule)
  groups: Group[];
  canEdit: boolean;
  canArchive: boolean;
  // the extra-info fields the viewer may edit, and their stored values
  infoFields?: InfoField[];
  infoValues?: Record<string, string>;
}) {
  const [open, setOpen] = useState<"edit" | "archive" | null>(null);
  if (!canEdit && !canArchive) return null;
  const gender = groups.find((g) => g.id === student.groupId)?.gender ?? "MIXED";

  return (
    <>
      <div className={styles.actions}>
        {canEdit && (
          <button type="button" className={styles.actionBtn} onClick={() => setOpen("edit")}>
            ✎ تعديل البيانات
          </button>
        )}
        {canArchive && (
          <button type="button" className={styles.actionBtn} onClick={() => setOpen("archive")}>
            🗄 أرشفة
          </button>
        )}
      </div>
      {open === "edit" && (
        <EditDialog
          student={student}
          groups={groups}
          infoFields={infoFields}
          infoValues={infoValues}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "archive" && <ArchiveDialog student={student} gender={gender} onClose={() => setOpen(null)} />}
    </>
  );
}

function EditDialog({
  student,
  groups,
  infoFields,
  infoValues,
  onClose,
}: {
  student: { id: string; name: string; age: number; grade: string | null; groupId: string };
  groups: Group[];
  infoFields: InfoField[];
  infoValues: Record<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(student.name);
  const [age, setAge] = useState(String(student.age));
  const [grade, setGrade] = useState(student.grade ?? "");
  const [groupId, setGroupId] = useState(student.groupId);
  const [info, setInfo] = useState(infoValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const newGroup = groups.find((g) => g.id === groupId);
  const g = newGroup?.gender ?? "MIXED";
  const groupChanged = groupId !== student.groupId;
  const oldGender = groups.find((x) => x.id === student.groupId)?.gender;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateStudentAction(student.id, { name, age: Number(age), grade, groupId, info });
      if (result.error) return setError(result.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div className={styles.dialog}>
        <div className={styles.title} id="edit-title">
          تعديل بيانات {studentNounDef(g)}
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-name">الاسم</label>
          <input id="edit-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-age">العمر</label>
          <input
            id="edit-age"
            className={styles.input}
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-grade">الصف (اختياري)</label>
          <input
            id="edit-grade"
            className={styles.input}
            value={grade}
            placeholder="مثال: الخامس"
            onChange={(e) => setGrade(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-group">المجموعة</label>
          <select id="edit-group" className={styles.input} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({GENDER_LABEL[x.gender]})
              </option>
            ))}
          </select>
          {groupChanged && newGroup && oldGender && oldGender !== newGroup.gender && (
            <div className={styles.hint}>
              ستُستخدم في كل الصفحات صيغة «{studentNoun(newGroup.gender)}» بحسب المجموعة الجديدة.
            </div>
          )}
        </div>
        <InfoFieldsInputs
          fields={infoFields}
          values={info}
          onChange={(id, value) => setInfo((prev) => ({ ...prev, [id]: value }))}
          groupGender={g}
          classes={{ field: styles.field, input: styles.input }}
          idPrefix="edit-info"
        />
        {error && <div className={styles.err}>{error}</div>}
        <div className={styles.buttons}>
          <button type="button" className={styles.primary} onClick={save} disabled={pending}>
            {pending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button type="button" className={styles.ghost} onClick={onClose} disabled={pending}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveDialog({
  student,
  gender: g,
  onClose,
}: {
  student: { id: string; name: string };
  gender: GroupGender;
  onClose: () => void;
}) {
  const router = useRouter();
  const [keepInReports, setKeepInReports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await archiveStudentAction(student.id, keepInReports);
      if (result.error) return setError(result.error);
      router.push("/students");
    });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="archive-title">
      <div className={styles.dialog}>
        <div className={styles.title} id="archive-title">
          أرشفة {studentNounDef(g)} «{student.name}»
        </div>
        <div className={styles.desc}>
          {p("يختفي", "تختفي")} من قوائم الطلاب ولوحة الإنجاز والعدّ، ويتوقف رمز ولي الأمر الخاص{" "}
          {p("به", "بها")} مؤقتًا. تبقى {p("بياناته", "بياناتها")} كلها محفوظة، ويمكن للإشراف{" "}
          {p("استعادته", "استعادتها")} من الأرشيف في أي وقت.
        </div>
        <div className={styles.field}>
          <label>هل تبقى {p("بياناته", "بياناتها")} ضمن التقارير؟</label>
          <div className={styles.pills} role="group">
            <button
              type="button"
              className={`${styles.pill} ${keepInReports ? styles.sel : ""}`}
              aria-pressed={keepInReports}
              onClick={() => setKeepInReports(true)}
            >
              نعم
            </button>
            <button
              type="button"
              className={`${styles.pill} ${!keepInReports ? styles.sel : ""}`}
              aria-pressed={!keepInReports}
              onClick={() => setKeepInReports(false)}
            >
              لا
            </button>
          </div>
        </div>
        {error && <div className={styles.err}>{error}</div>}
        <div className={styles.buttons}>
          <button type="button" className={styles.danger} onClick={confirm} disabled={pending}>
            {pending ? "جارٍ الأرشفة…" : "تأكيد الأرشفة"}
          </button>
          <button type="button" className={styles.ghost} onClick={onClose} disabled={pending}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
