"use client";

import { useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { useToday } from "@/lib/calendar/useToday";
import { daysBetween, gregorianLabelWithWeekday } from "@/lib/calendar/hijri";
import {
  addDays,
  dayScore,
  daysLabel,
  EVERY_DAY,
  isComplete,
  lastSevenDays,
  shownOn,
  TRACKER_LIMITS,
  weekdayOf,
  WEEKDAY_SHORT,
  withLocalDays,
} from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { addOwnTrackerItemAction, deleteOwnTrackerItemAction, renameOwnTrackerItemAction, setTrackerCheckAction } from "./actions";

const pointsLabel = (n: number) => (n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? `${n} درجات` : `${n} درجة`);

export function StudentTracker({ sheet, groupGender: g }: { sheet: TrackerSheet; groupGender: GroupGender }) {
  const today = useToday();
  const [which, setWhich] = useState<"today" | "yesterday">("today");
  // optimistic ticks keyed "day|itemId", dropped once the server's sheet catches up
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  if (!today) return <div className={hl.empty}>…</div>;

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
      const r = await setTrackerCheckAction({ itemId: item.id, day, today: today!, on });
      if (r.error) setError(r.error);
      setOverride((o) => {
        const next = { ...o };
        delete next[key];
        return next;
      });
    });
  }

  // D8: «لم يُعتمد» shows for a week after the decision, then disappears
  const ownWaiting = allItems.filter(
    (i) =>
      i.own &&
      i.archivedDay === null &&
      (i.status === "PENDING" || (i.status === "REJECTED" && i.reviewedDay !== null && daysBetween(i.reviewedDay, today) <= TRACKER_LIMITS.rejectedShowDays)),
  );

  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>✅ جدول المتابعة</span>
      </div>

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

      <OwnItems items={ownWaiting} g={g} />
    </div>
  );
}

function OwnItems({ items, g }: { items: TrackerItemView[]; g: GroupGender }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(EVERY_DAY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else after?.();
    });
  }

  return (
    <>
      <div className={hl.sectionTitle}>
        <span>بنودي الخاصة</span>
        {!adding && (
          <button type="button" className={hl.primaryBtn} onClick={() => setAdding(true)}>
            + بند خاص
          </button>
        )}
      </div>
      {adding && (
        <form
          className={hl.section}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addOwnTrackerItemAction({ title, days }),
              () => {
                setAdding(false);
                setTitle("");
                setDays(EVERY_DAY);
              },
            );
          }}
        >
          <div className={styles.field}>
            <label htmlFor="own-title">اسم البند</label>
            <input
              id="own-title"
              className={styles.input}
              value={title}
              maxLength={TRACKER_LIMITS.titleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: قراءة صفحة من كتاب"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>الأيام</span>
            <WeekdayPicker days={days} onChange={setDays} />
          </div>
          <div className={styles.hint} style={{ marginBottom: 8 }}>
            {p("يعتمده المعلم ويحدّد درجته، ويمكنك تعليمه قبل ذلك لكنه لا يُحتسب حتى يُعتمد.", "تعتمده المعلمة وتحدّد درجته، ويمكنكِ تعليمه قبل ذلك لكنه لا يُحتسب حتى يُعتمد.")}
          </div>
          {error && <div className={hl.err}>{error}</div>}
          <div className={hl.actionsRow}>
            <button type="submit" className={hl.primaryBtn} disabled={pending}>
              {pending ? "جارٍ الإرسال…" : "إرسال للاعتماد"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setAdding(false)} disabled={pending}>
              إلغاء
            </button>
          </div>
        </form>
      )}
      {items.length > 0 && (
        <div className={hl.section}>
          {items.map((i) => (
            <OwnRow key={i.id} item={i} run={run} pending={pending} />
          ))}
          {error && !adding && <div className={hl.err}>{error}</div>}
        </div>
      )}
    </>
  );
}

function OwnRow({
  item,
  run,
  pending,
}: {
  item: TrackerItemView;
  run: (fn: () => Promise<{ error?: string }>, after?: () => void) => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [title, setTitle] = useState(item.title);
  const waiting = item.status === "PENDING";

  return (
    <div className={styles.itemRow} style={{ display: "block" }}>
      {mode === "edit" ? (
        <input className={styles.input} value={title} maxLength={TRACKER_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} aria-label="اسم البند" />
      ) : (
        <div style={{ fontWeight: 800, fontSize: 15 }}>{item.title}</div>
      )}
      <div className={styles.meta}>
        <span className={`${styles.tag} ${waiting ? "" : styles.grey}`}>{waiting ? "بانتظار الاعتماد" : "لم يُعتمد"}</span>
        <span>{daysLabel(item.days)}</span>
      </div>
      <div className={styles.cardActions}>
        {mode === "view" && (
          <>
            {waiting && (
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("edit")}>
                تعديل الاسم
              </button>
            )}
            <button type="button" className={styles.dangerBtn} onClick={() => setMode("delete")}>
              حذف
            </button>
          </>
        )}
        {mode === "edit" && (
          <>
            <button type="button" className={hl.primaryBtn} disabled={pending} onClick={() => run(() => renameOwnTrackerItemAction(item.id, title), () => setMode("view"))}>
              حفظ
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              إلغاء
            </button>
          </>
        )}
        {mode === "delete" && (
          <>
            <span className={hl.muted} style={{ alignSelf: "center" }}>
              حذف هذا البند؟
            </span>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => deleteOwnTrackerItemAction(item.id))}>
              نعم، حذف
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              تراجع
            </button>
          </>
        )}
      </div>
    </div>
  );
}
