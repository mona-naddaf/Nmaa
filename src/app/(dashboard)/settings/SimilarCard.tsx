"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import { setMutashabihatAction } from "./actions";
import { OnOffPills } from "./StudentLoginCard";

/** «المتشابهات» in the course: one switch for teachers and the supervisor, one for students. */
export function SimilarCard({
  teachers,
  students,
  studentLoginEnabled,
  homeLogEnabled,
}: {
  teachers: boolean;
  students: boolean;
  studentLoginEnabled: boolean;
  homeLogEnabled: boolean;
}) {
  const [on, setOn] = useState({ teachers, students });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(audience: "teachers" | "students", value: boolean) {
    if (pending) return;
    const previous = on;
    setOn({ ...on, [audience]: value });
    setError(null);
    startTransition(async () => {
      const r = await setMutashabihatAction(audience, value);
      if (r.error) {
        setOn(previous);
        setError(r.error);
      }
    });
  }

  // students see the marks inside «حفظي في البيت», which needs student login
  const studentsNote = !studentLoginEnabled
    ? "لا يعمل إلا بعد تفعيل دخول الطلاب."
    : !homeLogEnabled
      ? "لا يعمل إلا بعد تفعيل «حفظي في البيت» في بطاقة دخول الطلاب."
      : null;

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingDesc}>
            علامة صغيرة «≈» بعد الآية التي لها آيات متشابهة في مواضع أخرى من القرآن، وعند الضغط عليها تظهر تلك الآيات مع تمييز الموضع
            المشترك في كل منها. المصدر: بيانات المتشابهات من QUL (ترتيل).
          </div>
        </div>
      </div>

      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>للمعلمين والمشرفين</div>
          <div className={styles.settingDesc}>في نص التسميع عند تحديد الأخطاء في صفحة الطالب، دون أن تعيق اختيار الكلمات.</div>
        </div>
        <OnOffPills on={on.teachers} onChange={(v) => toggle("teachers", v)} />
      </div>

      <div className={styles.settingRow} style={{ borderBottom: "none" }}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>للطلاب</div>
          <div className={styles.settingDesc}>
            في «حفظي في البيت»: عند اختيار مقطع جديد وفي صفحة التدريب. لا تظهر لأولياء الأمور.
            {studentsNote && <div style={{ color: "var(--gold-deep)", marginTop: 4 }}>{studentsNote}</div>}
          </div>
        </div>
        <OnOffPills on={on.students} onChange={(v) => toggle("students", v)} />
      </div>
      {error && <div className={styles.err}>{error}</div>}
    </>
  );
}

