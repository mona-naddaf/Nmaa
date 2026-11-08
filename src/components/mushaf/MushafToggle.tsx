"use client";

import styles from "./mushaf.module.css";
import { setMushafView, useMushafView } from "./useMushafView";

/**
 * The small switch above the verses: «صفحة المصحف» (the default) or «نص
 * كبير» (the old view: bigger words, easier to tap on a phone). The same
 * switch everywhere; the choice is kept on the device.
 */
export function MushafToggle({ feminine }: { feminine: boolean }) {
  const view = useMushafView();
  return (
    <div className={styles.toggleWrap}>
      <div className={styles.toggle} role="radiogroup" aria-label="طريقة عرض الآيات">
        {(
          [
            ["page", "صفحة المصحف"],
            ["text", "نص كبير"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            className={`${styles.toggleBtn} ${view === v ? styles.toggleSel : ""}`}
            onClick={() => setMushafView(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "page" && <div className={styles.phoneHint}>للنقر الدقيق على الكلمات {feminine ? "اختاري" : "اختر"} «نص كبير».</div>}
    </div>
  );
}
