"use client";

import { useState, useTransition } from "react";
import styles from "./shell.module.css";
import { setPersonGenderAction } from "./genderActions";

// One-time, skippable prompt for the current teacher's/admin's own gender —
// shown once (genderPrompted flips to true whatever the user picks) so it
// never reappears. Lives in the dashboard shell so it can catch both roles.
export function GenderPrompt({ initiallyPrompted }: { initiallyPrompted: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  if (initiallyPrompted || dismissed) return null;

  function choose(gender: "MALE" | "FEMALE" | null) {
    setDismissed(true);
    startTransition(() => {
      setPersonGenderAction(gender);
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.promptCard}>
        <div className={styles.promptTitle}>بأي صيغة نخاطبك؟</div>
        <div className={styles.promptDesc}>يساعدنا هذا على مخاطبتك بالصيغة الصحيحة (مثال: سجّل / سجّلي)</div>
        <div className={styles.promptOptions}>
          <button className={styles.promptBtn} type="button" onClick={() => choose("MALE")}>
            صيغة المذكر
          </button>
          <button className={styles.promptBtn} type="button" onClick={() => choose("FEMALE")}>
            صيغة المؤنث
          </button>
        </div>
        <button className={styles.promptSkip} type="button" onClick={() => choose(null)}>
          تخطي
        </button>
      </div>
    </div>
  );
}
