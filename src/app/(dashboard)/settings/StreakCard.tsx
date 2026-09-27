"use client";

import { useState, useTransition } from "react";
import styles from "./settings.module.css";
import { setStreakModeAction } from "./actions";
import type { StreakMode } from "@/lib/students/streak";

const OPTIONS: { value: StreakMode | null; label: string }[] = [
  { value: "ATTENDANCE", label: "بالحضور" },
  { value: "RECITATION", label: "بالتسميع" },
  { value: null, label: "غير مفعّل" },
];

export function StreakCard({ mode }: { mode: StreakMode | null }) {
  const [current, setCurrent] = useState(mode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(value: StreakMode | null) {
    if (value === current || pending) return;
    const previous = current;
    setCurrent(value);
    setError(null);
    startTransition(async () => {
      const result = await setStreakModeAction(value);
      if (result.error) {
        setCurrent(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className={styles.settingRow} style={{ borderBottom: "none" }}>
      <div className={styles.settingText}>
        <div className={styles.settingTitle}>متى يُحتسب الأسبوع؟</div>
        <div className={styles.settingDesc}>
          تظهر علامة 🔥 بعدد الأسابيع المتتالية على بطاقة الطالب وفي صفحته. &quot;بالحضور&quot;: حضر مرة واحدة على
          الأقل في الأسبوع. &quot;بالتسميع&quot;: سُجّلت له جلسة حفظ أو مراجعة أو ربط في الأسبوع. يبدأ الأسبوع يوم
          الأحد، والأسبوع الذي لم يُسجَّل فيه شيء لأي أحد من مجموعته (إجازة مثلًا) لا يقطع السلسلة.
        </div>
        {error && <div style={{ color: "var(--rose-deep)", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
      </div>
      <div className={styles.optionPills}>
        {OPTIONS.map((o) => (
          <div
            key={o.label}
            className={`${styles.optionPill} ${current === o.value ? styles.sel : ""}`}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}
