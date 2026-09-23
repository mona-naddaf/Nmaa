"use client";

import styles from "./date-range.module.css";
import type { DateRangePreset, DateRangeState } from "./useDateRange";

const PRESETS: [DateRangePreset, string][] = [
  ["all", "الدورة كاملة"],
  ["4w", "آخر 4 أسابيع"],
  ["8w", "آخر 8 أسابيع"],
  ["custom", "تحديد يدوي"],
];

export function DateRangeFilter({ range }: { range: DateRangeState }) {
  return (
    <>
      <div className={styles.tabs}>
        <div
          className={`${styles.tab} ${range.tab === "last" ? styles.active : ""}`}
          onClick={() => range.setTab("last")}
        >
          آخر جلسة
        </div>
        <div
          className={`${styles.tab} ${range.tab === "range" ? styles.active : ""}`}
          onClick={() => range.setTab("range")}
        >
          فترة تراكمية
        </div>
      </div>

      {range.tab === "range" && (
        <div className={styles.filterCard}>
          <div className={styles.presetRow} style={{ marginBottom: 12 }}>
            {PRESETS.map(([key, label]) => (
              <div
                key={key}
                className={`${styles.presetPill} ${range.preset === key ? styles.sel : ""}`}
                onClick={() => range.applyPreset(key)}
              >
                {label}
              </div>
            ))}
          </div>
          <div className={styles.filterRow}>
            <div className={styles.filterField}>
              <label htmlFor="fromDate">من تاريخ</label>
              <input
                id="fromDate"
                type="date"
                value={range.fromDate}
                onChange={(e) => range.setFromDate(e.target.value)}
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="toDate">إلى تاريخ</label>
              <input id="toDate" type="date" value={range.toDate} onChange={(e) => range.setToDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
