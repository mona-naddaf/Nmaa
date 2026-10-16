"use client";

import { useState } from "react";
import styles from "./mistakes.module.css";
import { toArabicDigits } from "./FlaggableAyah";
import { SUMMARY_RECENT_DAYS, type SummaryGroup, type TajweedSummary } from "@/lib/tajweed/summary";

// «ملخّص أخطاء التجويد»: her open detailed tajweed mistakes, counted by what
// they are about (lib/tajweed/summary.ts). Read-only; the same block on the
// staff page, the parent view and her own page. The caller decides whether
// it shows at all (switches on, and something to count).

type Period = "recent" | "all";

const count = (n: number) => toArabicDigits(n);

export function TajweedSummaryBlock({ summary, bare = false }: { summary: TajweedSummary; bare?: boolean }) {
  // nothing in the last 30 days but older ones still open: start with the whole period
  const [period, setPeriod] = useState<Period>(summary.recent.length > 0 ? "recent" : "all");
  const groups: SummaryGroup[] = summary[period];

  return (
    <div className={styles.summary}>
      {!bare && <div className={styles.summaryTitle}>ملخّص أخطاء التجويد</div>}
      <div className={styles.summaryPeriods} role="tablist">
        {(["recent", "all"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            className={`pressable ${styles.summaryPeriod} ${period === p ? styles.summaryPeriodSel : ""}`}
            onClick={() => setPeriod(p)}
          >
            {p === "recent" ? `آخر ${count(SUMMARY_RECENT_DAYS)} يومًا` : "كل الفترة"}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <div className={styles.summaryEmpty}>لا توجد أخطاء تجويد مفصّلة في آخر {count(SUMMARY_RECENT_DAYS)} يومًا.</div>
      ) : (
        <ul className={styles.summaryList}>
          {groups.map((g) => (
            <li key={g.key} className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                {g.label} <span className={styles.summaryCount}>({count(g.count)})</span>
              </span>
              {g.parts.length > 0 && (
                <span className={styles.summaryParts}>{g.parts.map((p) => `${p.label} ${count(p.count)}`).join("، ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
