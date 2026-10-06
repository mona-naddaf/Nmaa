"use client";

import { useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./work.module.css";
import { gregorianLabelWithWeekday } from "@/lib/calendar/hijri";
import { addDays, dayScore, isComplete, lastSevenDays, shownOn, weekdayOf, WEEKDAY_SHORT, withLocalDays } from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

const pointsLabel = (n: number) => (n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? `${n} درجات` : `${n} درجة`);

export type TickInput = { itemId: string; day: string; today: string; on: boolean };

/**
 * Ticking the tracker: today and yesterday as big tiles, the day's score,
 * and the last seven days. Shared by the course student and «رفيق الحفظ»;
 * onTick is the caller's own server action. today: her local date.
 */
export function TrackerDaySheet({
  sheet,
  groupGender: g,
  today,
  onTick,
}: {
  sheet: TrackerSheet;
  groupGender: GroupGender;
  today: string;
  onTick: (input: TickInput) => Promise<{ error?: string }>;
}) {
  const [which, setWhich] = useState<"today" | "yesterday">("today");
  // optimistic ticks keyed "day|itemId", dropped once the server's sheet catches up
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  // items exist from her local creation day (not the UTC one)
  const allItems = withLocalDays(sheet.items);
  const yesterday = addDays(today, -1);
  const day = which === "today" ? today : yesterday;
  const checkedOn = (d: string) => {
    const set = new Set(sheet.checks[d] ?? []);
    for (const [key, on] of Object.entries(override)) {
      const [kd, id] = key.split("|");
      if (kd !== d) continue;
      if (on) set.add(id);
      else set.delete(id);
    }
    return set;
  };
  const checked = checkedOn(day);
  const items = allItems.filter((i) => shownOn(i, day));
  const score = dayScore(allItems, checked, day);
  const complete = isComplete(score);
  const pct = score.possible ? Math.round((score.earned / score.possible) * 100) : 0;

  function toggle(item: TrackerItemView) {
    const key = `${day}|${item.id}`;
    const on = !checked.has(item.id);
    setError(null);
    setOverride((o) => ({ ...o, [key]: on }));
    startTransition(async () => {
      const r = await onTick({ itemId: item.id, day, today, on });
      if (r.error) setError(r.error);
      setOverride((o) => {
        const next = { ...o };
        delete next[key];
        return next;
      });
    });
  }

  return (
    <>
        <div className={styles.dayTabs} role="tablist">
          {(["today", "yesterday"] as const).map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={which === w}
              className={`${styles.dayTab} ${which === w ? styles.sel : ""}`}
              onClick={() => setWhich(w)}
            >
              {w === "today" ? "اليوم" : "أمس"}
              <small>{gregorianLabelWithWeekday(w === "today" ? today : yesterday)}</small>
            </button>
          ))}
        </div>

        {score.possible > 0 && (
          <div className={`${styles.score} ${complete ? styles.complete : ""}`} role="status" aria-live="polite">
            <div className={styles.scoreNum}>
              {score.earned}
              <small> / {score.possible}</small>
            </div>
            <div style={{ flex: 1 }}>
              <div className={styles.scoreTrack} aria-hidden>
                <div className={styles.scoreFill} style={{ width: `${pct}%` }} />
              </div>
              <div className={hl.muted} style={{ marginTop: 4 }}>
                {complete
                  ? p(`أحسنتَ! أكملتَ بنود ${which === "today" ? "اليوم" : "الأمس"}`, `أحسنتِ! أكملتِ بنود ${which === "today" ? "اليوم" : "الأمس"}`)
                  : `درجة ${which === "today" ? "اليوم" : "الأمس"}`}
              </div>
            </div>
            {complete && (
              <span key={day} className={styles.celebrateIcon} aria-hidden>
                🎉
              </span>
            )}
          </div>
        )}

        {error && (
          <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className={hl.section}>
            <div className={hl.empty}>لا توجد بنود لهذا اليوم.</div>
          </div>
        ) : (
          <div className={styles.tiles}>
            {items.map((item) => {
              const on = checked.has(item.id);
              const pending = item.status === "PENDING";
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.tile} ${on ? styles.on : ""} ${pending ? styles.pending : ""}`}
                  onClick={() => toggle(item)}
                  aria-pressed={on}
                >
                  <span className={styles.tileTitle}>{item.title}</span>
                  <span className={styles.tileFoot}>
                    <span>{pending ? "بانتظار الاعتماد" : pointsLabel(item.value ?? 0)}</span>
                    <span className={styles.tileCheck} aria-hidden>
                      {on ? "✓" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={hl.sectionTitle}>آخر سبعة أيام</div>
        <div className={styles.strip}>
          {lastSevenDays(today).map((d) => {
            const s = dayScore(allItems, checkedOn(d), d);
            return (
              <div key={d} className={`${styles.stripDay} ${isComplete(s) ? styles.full : ""} ${d === today ? styles.today : ""}`} title={gregorianLabelWithWeekday(d)}>
                {WEEKDAY_SHORT[weekdayOf(d)]}
                <b>{s.possible ? `${s.earned}/${s.possible}` : "—"}</b>
                {isComplete(s) ? "🌟" : ""}
              </div>
            );
          })}
        </div>
    </>
  );
}
