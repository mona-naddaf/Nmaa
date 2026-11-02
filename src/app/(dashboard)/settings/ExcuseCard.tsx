"use client";

import { useState, useTransition } from "react";
import { COURSE_EXCUSE_NO_TRACKER, EXCUSE_SWITCH, courseExcuseDesc } from "@/lib/excuse/texts";
import type { PersonGender } from "@/lib/text/gender";
import styles from "./settings.module.css";
import { setCourseExcuseAction } from "./actions";

/** G2–G4: the course's switch. Off by default. */
export function ExcuseCard({ enabled, trackerEnabled, adminGender }: { enabled: boolean; trackerEnabled: boolean; adminGender: PersonGender }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(on: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await setCourseExcuseAction(on).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" }));
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className={styles.settingRow} style={{ borderBottom: "none" }}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>{EXCUSE_SWITCH}</div>
        <div className={styles.settingDesc}>{courseExcuseDesc(adminGender)}</div>
        {enabled && !trackerEnabled && <div className={styles.settingDesc}>{COURSE_EXCUSE_NO_TRACKER}</div>}
        {error && (
          <div className={styles.settingDesc} role="alert">
            {error}
          </div>
        )}
      </div>
      <div className={styles.optionPills}>
        <div className={`${styles.optionPill} ${enabled ? styles.sel : ""}`} onClick={() => set(true)}>
          مفعّل
        </div>
        <div className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`} onClick={() => set(false)}>
          غير مفعّل
        </div>
      </div>
    </div>
  );
}
