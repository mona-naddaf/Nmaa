"use client";

import styles from "./work.module.css";
import { EVERY_DAY, TRACKER_LIMITS, WEEKDAY_LABELS, toggleWeekday } from "@/lib/tracker/rules";

/**
 * «كل يوم» or chosen weekdays, as the bitmask the server stores. Unticking the
 * last day is refused (onEmpty, if given, is told so it can say why).
 */
export function WeekdayPicker({ days, onChange, onEmpty }: { days: number; onChange: (days: number) => void; onEmpty?: () => void }) {
  const every = days === EVERY_DAY;
  return (
    <div>
      <div className={styles.pills} role="group" aria-label="أيام البند" style={{ marginBottom: 6 }}>
        <button type="button" className={`${styles.pill} ${every ? styles.sel : ""}`} onClick={() => onChange(EVERY_DAY)} aria-pressed={every}>
          كل يوم
        </button>
        <button
          type="button"
          className={`${styles.pill} ${!every ? styles.sel : ""}`}
          onClick={() => every && onChange(EVERY_DAY & ~(1 << 5))}
          aria-pressed={!every}
        >
          أيام محدّدة
        </button>
      </div>
      {!every && (
        <div className={styles.pills} role="group" aria-label="الأيام">
          {WEEKDAY_LABELS.map((label, i) => {
            const on = (days & (1 << i)) !== 0;
            return (
              <button
                key={label}
                type="button"
                className={`${styles.pill} ${on ? styles.sel : ""}`}
                aria-pressed={on}
                // never leave zero days selected
                onClick={() => {
                  const next = toggleWeekday(days, i);
                  if (next !== null) onChange(next);
                  else onEmpty?.();
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Score 1–10 as tap-sized pills. */
export function ValuePicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const values = Array.from({ length: TRACKER_LIMITS.valueMax - TRACKER_LIMITS.valueMin + 1 }, (_, i) => TRACKER_LIMITS.valueMin + i);
  return (
    <div className={styles.pills} role="group" aria-label="الدرجة">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={`${styles.pill} ${value === v ? styles.sel : ""}`}
          style={{ minWidth: 44, justifyContent: "center", padding: 0 }}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
