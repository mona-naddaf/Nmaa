"use client";

import { useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./work.module.css";
import { useToday } from "@/lib/calendar/useToday";
import { gregorianLabel } from "@/lib/calendar/hijri";
import { addDays, countsOn, dayScore, isComplete, shownOn, weekdayOf, weekDays, WEEKDAY_SHORT, withLocalDays } from "@/lib/tracker/rules";
import type { TrackerSheet } from "@/lib/tracker/data";

/**
 * One student's week (Sunday–Saturday), read-only: a row per item, a ✓ per
 * ticked day, each day's score and the week's total. For staff and parents.
 * Weeks are the viewer's own local week; scores are calculated (D6).
 */
export function TrackerWeek({ sheet }: { sheet: TrackerSheet }) {
  const today = useToday();
  const [offset, setOffset] = useState(0);
  if (!today) return <div className={hl.empty}>…</div>;

  const items = withLocalDays(sheet.items);
  const days = weekDays(addDays(today, offset * 7));
  const scores = days.map((d) => (d > today ? null : dayScore(items, new Set(sheet.checks[d] ?? []), d)));
  const earned = scores.reduce((n, s) => n + (s?.earned ?? 0), 0);
  const possible = scores.reduce((n, s) => n + (s?.possible ?? 0), 0);
  const fullDays = scores.filter((s) => s && isComplete(s)).length;
  const rows = items.filter((item) => days.some((d) => shownOn(item, d)));

  return (
    <div>
      <div className={styles.toolbar} style={{ marginBottom: 8 }}>
        <div className={hl.muted}>
          الأسبوع من {gregorianLabel(days[0])} إلى {gregorianLabel(days[6])}
        </div>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${offset === -1 ? styles.sel : ""}`} onClick={() => setOffset(-1)}>
            الأسبوع الماضي
          </button>
          <button type="button" className={`${styles.pill} ${offset === 0 ? styles.sel : ""}`} onClick={() => setOffset(0)}>
            هذا الأسبوع
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={hl.empty}>لا توجد بنود في هذا الأسبوع.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>البند</th>
                {days.map((d) => (
                  <th key={d} title={gregorianLabel(d)}>
                    {WEEKDAY_SHORT[weekdayOf(d)]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title}{" "}
                    <span className={hl.muted}>
                      {item.status === "PENDING" ? "(بانتظار الاعتماد)" : item.status === "REJECTED" ? "(لم يُعتمد)" : `(${item.value})`}
                    </span>
                  </td>
                  {days.map((d) => {
                    if (!shownOn(item, d)) return <td key={d} className={styles.cellNone}>—</td>;
                    const ticked = (sheet.checks[d] ?? []).includes(item.id);
                    return (
                      <td key={d} className={ticked && countsOn(item, d) ? styles.cellFull : undefined}>
                        {ticked ? "✓" : d > today ? "" : "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td>
                  <b>مجموع اليوم</b>
                </td>
                {scores.map((s, i) => (
                  <td key={days[i]} className={s && isComplete(s) ? styles.cellFull : undefined}>
                    {s ? (s.possible === 0 ? "—" : `${s.earned}/${s.possible}`) : ""}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.meta} style={{ marginTop: 10, fontSize: 13 }}>
        <span>
          <b>مجموع الأسبوع:</b> {earned} من {possible}
          {possible > 0 && ` (${Math.round((earned / possible) * 100)}٪)`}
        </span>
        <span>
          <b>أيام مكتملة:</b> {fullDays}
        </span>
      </div>
    </div>
  );
}
