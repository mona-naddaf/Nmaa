"use client";

import { useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./work.module.css";
import { gregorianLabelWithWeekday } from "@/lib/calendar/hijri";
import { addDays, dayScore, isComplete, lastSevenDays, shownOn, weekdayOf, WEEKDAY_SHORT, withLocalDays, type DayScore, type ScoredItem } from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { TickMark } from "./TickMark";
import { useDayCelebration } from "./DayCelebration";
import { useGuideTarget } from "@/components/guide/targets";

const pointsLabel = (n: number) => (n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? `${n} درجات` : `${n} درجة`);

export type TickInput = { itemId: string; day: string; today: string; on: boolean };

/**
 * Optimistic ticks ("day|itemId" → on) still ahead of the server's sheet.
 * Each stays until a sheet agrees with it (or its action fails): dropping it
 * when the action returns showed the old state for a moment, until the
 * refreshed sheet arrived.
 */
export function pruneAgreed(override: Record<string, boolean>, sheet: TrackerSheet): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const [key, on] of Object.entries(override)) {
    const [d, id] = key.split("|");
    if ((sheet.checks[d] ?? []).includes(id) !== on) next[key] = on;
  }
  return next;
}

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
  celebrateKey,
  readOnly = false,
  emptyDay,
}: {
  sheet: TrackerSheet;
  groupGender: GroupGender;
  today: string;
  onTick: (input: TickInput) => Promise<{ error?: string }>;
  // who is ticking, for the once-a-day celebration (none: never celebrates)
  celebrateKey?: string;
  // shown without ticking («العائلة»: a view-only adult on a child's tracker)
  readOnly?: boolean;
  // Rafiq's guidance: its wording for a day with no items (unset: as before)
  emptyDay?: string;
}) {
  const [which, setWhich] = useState<"today" | "yesterday">("today");
  // optimistic ticks keyed "day|itemId", dropped once the server's sheet catches up
  const [override, setOverride] = useState<Record<string, boolean>>({});
  // a new sheet from the server: forget the optimistic ticks it now agrees with
  const [seen, setSeen] = useState(sheet);
  if (seen !== sheet) {
    setSeen(sheet);
    setOverride((o) => pruneAgreed(o, sheet));
  }
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const tz = useTimeZone();
  const party = useDayCelebration(celebrateKey, today, g);
  const t = useGuideTarget();

  // items exist from the day they were created (the course's day, or hers in «رفيق الحفظ»; not the UTC one)
  const allItems = withLocalDays(sheet.items, tz);
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

  function toggle(item: TrackerItemView) {
    if (readOnly) return;
    const key = `${day}|${item.id}`;
    const on = !checked.has(item.id);
    // her tick that first makes today complete: the celebration
    if (on && day === today && !isComplete(score) && isComplete(dayScore(allItems, new Set(checked).add(item.id), day))) party.celebrate();
    setError(null);
    setOverride((o) => ({ ...o, [key]: on }));
    startTransition(async () => {
      const r = await onTick({ itemId: item.id, day, today, on });
      // success: kept until the refreshed sheet agrees (pruneAgreed)
      if (!r.error) return;
      setError(r.error);
      setOverride((o) => {
        const next = { ...o };
        delete next[key];
        return next;
      });
    });
  }

  return (
    // relative: the celebration's layer covers (and is clipped to) the day area
    <div style={{ position: "relative" }} {...t("tracker.sheet")}>
        {party.layer}
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

        <DayScoreBar score={score} yesterday={which === "yesterday"} groupGender={g} />

        {error && (
          <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className={hl.section}>
            <div className={hl.empty}>{emptyDay ?? "لا توجد بنود لهذا اليوم."}</div>
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
                  disabled={readOnly}
                  aria-pressed={on}
                >
                  <span className={styles.tileTitle}>{item.title}</span>
                  <span className={styles.tileFoot}>
                    <span>{pending ? "بانتظار الاعتماد" : pointsLabel(item.value ?? 0)}</span>
                    <span className={styles.tileCheck} aria-hidden>
                      <TickMark on={on} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <LastSevenDays items={allItems} checkedOn={checkedOn} today={today} />
    </div>
  );
}

/** The day's score: earned / possible, a bar, and «أحسنت» once complete. Nothing when the day has no scored items. */
export function DayScoreBar({ score, yesterday = false, groupGender: g }: { score: DayScore; yesterday?: boolean; groupGender: GroupGender }) {
  if (score.possible === 0) return null;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const complete = isComplete(score);
  const pct = Math.round((score.earned / score.possible) * 100);
  const dayName = yesterday ? "الأمس" : "اليوم";
  return (
    <div className={`${styles.score} ${complete ? styles.complete : ""}`} role="status" aria-live="polite">
      <div className={styles.scoreNum}>
        {score.earned}
        <small> / {score.possible}</small>
      </div>
      <div style={{ flex: 1 }}>
        <div className={styles.scoreTrack} aria-hidden>
          <div className={styles.scoreFill} style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className={hl.muted} style={{ marginTop: 4 }}>
          {complete ? p(`أحسنتَ! أكملتَ بنود ${dayName}`, `أحسنتِ! أكملتِ بنود ${dayName}`) : `درجة ${dayName}`}
        </div>
      </div>
      {complete && (
        <span key={score.day} className={styles.celebrateIcon} aria-hidden>
          🎉
        </span>
      )}
    </div>
  );
}

/** «آخر سبعة أيام»: each day's earned/possible, a star when complete. */
export function LastSevenDays({ items, checkedOn, today }: { items: ScoredItem[]; checkedOn: (day: string) => Set<string>; today: string }) {
  return (
    <>
      <div className={hl.sectionTitle}>آخر سبعة أيام</div>
      <div className={styles.strip}>
        {lastSevenDays(today).map((d) => {
          const s = dayScore(items, checkedOn(d), d);
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
