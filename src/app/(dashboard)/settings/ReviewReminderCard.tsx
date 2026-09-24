"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import { setReviewReminderDaysAction } from "./actions";
import { DEFAULT_REVIEW_REMINDER_DAYS } from "@/lib/students/review";

export function ReviewReminderCard({ days }: { days: number | null }) {
  const [draft, setDraft] = useState(String(days ?? DEFAULT_REVIEW_REMINDER_DAYS));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const enabled = days !== null;

  function save(value: number | null) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setReviewReminderDaysAction(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (value !== null) {
        setDraft(String(value));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  const draftNumber = Number(draft);
  const draftValid = Number.isInteger(draftNumber) && draftNumber >= 1 && draftNumber <= 365;

  return (
    <div className={styles.settingRow} style={{ borderBottom: "none" }}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>مدة عدم المراجعة</div>
        <div className={styles.settingDesc}>
          تظهر علامة 🔁 على بطاقة الطالب في القائمة إذا مضت هذه المدة على أي سورة أتمّ حفظها دون أن تُراجَع كاملةً
          (بجلسة &quot;مراجعة&quot; أو &quot;ربط&quot;)، وتظهر السور المعنية في صفحته.
        </div>
        {enabled && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              max={365}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="عدد الأيام"
              style={{
                width: 90,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--cream)",
                fontSize: 14,
                color: "var(--ink)",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>يومًا</span>
            <button
              type="button"
              className={styles.copyBtn}
              style={{ marginTop: 0 }}
              disabled={pending || !draftValid || draftNumber === days}
              onClick={() => save(draftNumber)}
            >
              {saved ? "تم الحفظ ✓" : "حفظ"}
            </button>
          </div>
        )}
        {error && <div style={{ color: "var(--rose-deep)", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </div>
      <div className={styles.optionPills}>
        <div
          className={`${styles.optionPill} ${enabled ? styles.sel : ""}`}
          onClick={() => !enabled && !pending && save(DEFAULT_REVIEW_REMINDER_DAYS)}
        >
          مفعّل
        </div>
        <div
          className={`${styles.optionPill} ${!enabled ? styles.sel : ""}`}
          onClick={() => enabled && !pending && save(null)}
        >
          غير مفعّل
        </div>
      </div>
    </div>
  );
}
