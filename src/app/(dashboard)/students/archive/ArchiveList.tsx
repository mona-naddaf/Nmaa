"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../[id]/manage.module.css";
import listStyles from "./archive.module.css";
import { deleteStudentPermanentlyAction, restoreStudentAction, setKeepInReportsAction } from "./actions";
import { pickByGroup, studentNounDef, type GroupGender } from "@/lib/text/gender";

type ArchivedStudent = {
  id: string;
  name: string;
  grade: string | null;
  groupName: string;
  gender: GroupGender;
  archivedAt: string;
  keepInReports: boolean;
};

export function ArchiveList({ students }: { students: ArchivedStudent[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ArchivedStudent | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (students.length === 0) {
    return <div className={listStyles.empty}>لا يوجد أحد في الأرشيف.</div>;
  }

  return (
    <>
      {error && <div className={styles.err}>{error}</div>}
      <div className={listStyles.list}>
        {students.map((s) => {
          const p = (m: string, f: string) => pickByGroup(s.gender, { m, f });
          return (
            <div key={s.id} className={listStyles.row}>
              <div className={listStyles.info}>
                <Link href={`/students/${s.id}`} className={listStyles.name}>
                  {s.name}
                </Link>
                <div className={listStyles.meta}>
                  {s.groupName}
                  {s.grade && ` · ${s.grade.startsWith("الصف") ? s.grade : `الصف ${s.grade}`}`} · في الأرشيف منذ{" "}
                  {s.archivedAt}
                </div>
                <div className={listStyles.reports}>
                  <span>{p("بياناته", "بياناتها")} ضمن التقارير:</span>
                  <button
                    type="button"
                    className={`${listStyles.toggle} ${s.keepInReports ? listStyles.on : ""}`}
                    aria-pressed={s.keepInReports}
                    disabled={pending}
                    onClick={() => run(() => setKeepInReportsAction(s.id, !s.keepInReports))}
                  >
                    {s.keepInReports ? "نعم" : "لا"}
                  </button>
                </div>
              </div>
              <div className={listStyles.buttons}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={pending}
                  onClick={() => run(() => restoreStudentAction(s.id))}
                >
                  استعادة
                </button>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => setDeleting(s)}>
                  حذف نهائي
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {deleting && (
        <DeleteDialog
          student={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DeleteDialog({
  student,
  onClose,
  onDeleted,
}: {
  student: ArchivedStudent;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const g = student.gender;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  // same comparison the server makes: ignore tashkeel, tatweel and extra spaces
  const norm = (v: string) => v.normalize("NFC").replace(/[ً-ٰٟـ]/g, "").replace(/\s+/g, " ").trim();
  const matches = norm(typed) === norm(student.name);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteStudentPermanentlyAction(student.id, typed);
      if (result.error) setError(result.error);
      else onDeleted();
    });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className={styles.dialog}>
        <div className={styles.title} id="delete-title">
          ⚠️ حذف {studentNounDef(g)} «{student.name}» نهائيًا
        </div>
        <div className={styles.desc}>
          سيُحذف {p("سجلّه", "سجلّها")} كاملًا: الخطة، وكل جلسات التسميع، والنقاط، والحضور، والأخطاء المسجَّلة، ورمز ولي
          الأمر. <b>لا يمكن التراجع عن هذا الإجراء</b>، ولن {p("يظهر", "تظهر")} في أي تقرير بعده.
        </div>
        <div className={styles.field}>
          <label htmlFor="confirm-name">
            للتأكيد، يُرجى كتابة الاسم كما هو: <b>{student.name}</b>
          </label>
          <input
            id="confirm-name"
            className={styles.input}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        {error && <div className={styles.err}>{error}</div>}
        <div className={styles.buttons}>
          <button type="button" className={styles.danger} onClick={confirm} disabled={!matches || pending}>
            {pending ? "جارٍ الحذف…" : "حذف نهائي"}
          </button>
          <button type="button" className={styles.ghost} onClick={onClose} disabled={pending}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
