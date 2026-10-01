"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import { setStudentBoardEnabledAction, setStudentLoginEnabledAction } from "./actions";

export function StudentLoginCard({ enabled, boardEnabled }: { enabled: boolean; boardEnabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // the board option only means something while student login is on
  const dependent = enabled ? undefined : { opacity: 0.5, pointerEvents: "none" as const };

  function run(action: () => Promise<{ error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>دخول الطلاب</div>
          <div className={styles.settingDesc}>
            يدخل كل طالب بالاسم ورمز خاص به (منفصل عن رمز وليّ الأمر)، ليرى موقعه في الخطة وأشرطة التقدّم والكلمات
            التي يتدرّب عليها ونقاطه، للعرض فقط. عند الإيقاف تُخفى رموز الطلاب ويُرفض دخولهم، وتنتهي جلساتهم المفتوحة.
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${enabled ? styles.sel : ""}`}
            onClick={() => !enabled && !pending && run(() => setStudentLoginEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`}
            onClick={() => enabled && !pending && run(() => setStudentLoginEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>

      <div className={styles.settingRow} style={dependent} aria-disabled={!enabled}>
        <div className={styles.settingText}>
          <div className={styles.settingTitle}>لوحة الإنجاز للطلاب</div>
          <div className={styles.settingDesc}>
            إظهار لوحة إنجاز الدورة للطلاب بعد دخولهم (بأسماء جميع طلاب الدورة ونقاطهم وصفحاتهم)، مستقلًا عن رمز
            لوحة الإنجاز العامة.
            {!enabled && " (يتاح بعد تفعيل دخول الطلاب)"}
          </div>
        </div>
        <div className={styles.optionPills}>
          <div
            className={`${styles.optionPill} ${boardEnabled ? styles.sel : ""}`}
            onClick={() => !boardEnabled && !pending && run(() => setStudentBoardEnabledAction(true))}
          >
            مفعّل
          </div>
          <div
            className={`${styles.optionPill} ${!boardEnabled ? styles.sel : ""}`}
            onClick={() => boardEnabled && !pending && run(() => setStudentBoardEnabledAction(false))}
          >
            غير مفعّل
          </div>
        </div>
      </div>
      {error && <div className={styles.err}>{error}</div>}
    </>
  );
}
