"use client";

import { useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./agenda.module.css";
import work from "./work.module.css";
import { clockLabel, clockValue, shiftEnd, timeFromInputs } from "@/lib/tracker/agenda";
import { WEEKDAY_SHORT } from "@/lib/tracker/rules";
import { copyToDays, OFFSET_MAX, resolveTiming, scheduleModel, scheduleRows, timingLabel, type SlotRow, type Timing } from "@/lib/tracker/schedule";
import { PRAYERS, PRAYER_NAME, type Prayer } from "@/lib/prayer/times";

// An item's schedule (lib/tracker/schedule.ts): every day, or per weekday
// («نسخ إلى أيام أخرى»); each a clock time, a prayer anchor (when a place is
// set) or «بلا وقت». Controlled by its rows: onChange gets the rows to save.

export type ScheduleInput = { weekdays: number; timing: Timing }[];

export function ScheduleEditor({
  rows,
  activeDays,
  anchors,
  prayers,
  onChange,
}: {
  rows: SlotRow[];
  // the item's weekdays (bitmask): only these get their own timing
  activeDays: number;
  // a place is set, so prayer anchors are available
  anchors: boolean;
  // today's prayer times, for a preview of an anchor
  prayers: Record<Prayer, number> | null;
  onChange: (rows: ScheduleInput, valid: boolean) => void;
}) {
  const initial = scheduleModel(rows);
  const [base, setBase] = useState<Timing | undefined>(initial.base);
  const [days, setDays] = useState(initial.days);
  const [scope, setScope] = useState<"ALL" | number>("ALL");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTo, setCopyTo] = useState<Set<number>>(new Set());
  const active = [0, 1, 2, 3, 4, 5, 6].filter((w) => activeDays & (1 << w));

  function update(nextBase: Timing | undefined, nextDays: typeof days, valid = true) {
    setBase(nextBase);
    setDays(nextDays);
    onChange(scheduleRows(nextBase, nextDays), valid);
  }

  const dayTiming = scope === "ALL" ? undefined : days[scope];

  return (
    <div>
      {active.length > 1 && (
        <div className={work.pills} style={{ marginBottom: 10 }} role="tablist" aria-label="الأيام">
          <button type="button" role="tab" aria-selected={scope === "ALL"} className={`${work.pill} ${scope === "ALL" ? work.sel : ""}`} onClick={() => setScope("ALL")}>
            كل الأيام
          </button>
          {active.map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={scope === w}
              className={`${work.pill} ${scope === w ? work.sel : ""}`}
              onClick={() => {
                setScope(w);
                setCopyOpen(false);
              }}
            >
              {WEEKDAY_SHORT[w]}
              {days[w] !== undefined && " •"}
            </button>
          ))}
        </div>
      )}

      {scope === "ALL" ? (
        <TimingInput key="ALL" value={base ?? null} anchors={anchors} prayers={prayers} onChange={(t, ok) => update(t, days, ok)} />
      ) : dayTiming === undefined ? (
        <div className={styles.editor} style={{ marginBottom: 0 }}>
          <div className={hl.muted} style={{ marginBottom: 8 }}>
            {WEEKDAY_SHORT[scope]}: مثل كل الأيام ({timingLabel(base ?? null)})
          </div>
          <button type="button" className={hl.ghostBtn} onClick={() => update(base, { ...days, [scope]: base ?? null })}>
            وقت خاص بهذا اليوم
          </button>
        </div>
      ) : (
        <>
          <TimingInput key={scope} value={dayTiming} anchors={anchors} prayers={prayers} onChange={(t, ok) => update(base, { ...days, [scope]: t }, ok)} />
          <div className={hl.actionsRow} style={{ marginTop: 8 }}>
            <button
              type="button"
              className={hl.ghostBtn}
              onClick={() => {
                const next = { ...days };
                delete next[scope];
                update(base, next);
              }}
            >
              مثل كل الأيام
            </button>
            {active.length > 2 && (
              <button type="button" className={hl.ghostBtn} onClick={() => setCopyOpen(!copyOpen)}>
                نسخ إلى أيام أخرى…
              </button>
            )}
          </div>
          {copyOpen && (
            <div className={styles.editor} style={{ marginTop: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                {active
                  .filter((w) => w !== scope)
                  .map((w) => (
                    <label key={w} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={copyTo.has(w)}
                        onChange={() =>
                          setCopyTo((prev) => {
                            const next = new Set(prev);
                            if (next.has(w)) next.delete(w);
                            else next.add(w);
                            return next;
                          })
                        }
                      />
                      {WEEKDAY_SHORT[w]}
                    </label>
                  ))}
              </div>
              <button
                type="button"
                className={hl.primaryBtn}
                style={{ marginTop: 8 }}
                disabled={copyTo.size === 0}
                onClick={() => {
                  update(base, copyToDays(days, dayTiming, [...copyTo]));
                  setCopyOpen(false);
                  setCopyTo(new Set());
                }}
              >
                نسخ وقت {WEEKDAY_SHORT[scope]}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type Mode = "NONE" | "CLOCK" | "PRAYER";

/** One timing: a clock time, a prayer anchor or «بلا وقت». */
function TimingInput({
  value,
  anchors,
  prayers,
  onChange,
}: {
  value: Timing;
  anchors: boolean;
  prayers: Record<Prayer, number> | null;
  onChange: (t: Timing, valid: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>(value === null ? "NONE" : value.kind);
  const [start, setStart] = useState(value?.kind === "CLOCK" ? clockValue(value.startMin) : "");
  const [end, setEnd] = useState(value?.kind === "CLOCK" && value.durationMin ? clockValue(value.startMin + value.durationMin) : "");
  const [prayer, setPrayer] = useState<Prayer>(value?.kind === "PRAYER" ? value.prayer : "FAJR");
  const [before, setBefore] = useState(value?.kind === "PRAYER" && value.offsetMin < 0);
  const [offset, setOffset] = useState(value?.kind === "PRAYER" ? String(Math.abs(value.offsetMin)) : "0");
  const [duration, setDuration] = useState(value?.durationMin ? String(value.durationMin) : "");
  const [problem, setProblem] = useState<string | null>(null);

  function emit(next: { mode?: Mode; start?: string; end?: string; prayer?: Prayer; before?: boolean; offset?: string; duration?: string }) {
    const m = next.mode ?? mode;
    if (m === "NONE") {
      setProblem(null);
      return onChange(null, true);
    }
    if (m === "CLOCK") {
      const s = next.start ?? start;
      if (!s) {
        setProblem("يُرجى اختيار وقت البداية");
        return onChange(null, false);
      }
      const t = timeFromInputs(s, next.end ?? end);
      if ("error" in t) {
        setProblem(t.error);
        return onChange(null, false);
      }
      setProblem(null);
      return onChange({ kind: "CLOCK", ...t }, true);
    }
    const mins = Number(next.offset ?? offset);
    const dur = (next.duration ?? duration).trim();
    const d = dur ? Number(dur) : null;
    if (!Number.isInteger(mins) || mins < 0 || mins > OFFSET_MAX) {
      setProblem(`يُرجى إدخال دقائق من 0 إلى ${OFFSET_MAX}`);
      return onChange(null, false);
    }
    if ((next.before ?? before) && mins === 0) {
      setProblem("يُرجى تحديد كم دقيقة قبل الصلاة");
      return onChange(null, false);
    }
    if (d !== null && (!Number.isInteger(d) || d < 5 || d > 720)) {
      setProblem("يُرجى أن تكون المدة من 5 إلى 720 دقيقة");
      return onChange(null, false);
    }
    setProblem(null);
    onChange({ kind: "PRAYER", prayer: next.prayer ?? prayer, offsetMin: (next.before ?? before) ? -mins : mins, durationMin: d }, true);
  }

  const preview =
    mode === "PRAYER" && prayers
      ? resolveTiming({ kind: "PRAYER", prayer, offsetMin: before ? -Number(offset || 0) : Number(offset || 0), durationMin: null }, prayers)
      : null;

  return (
    <div className={styles.editor} style={{ marginBottom: 0 }}>
      <div className={work.pills} style={{ marginBottom: 10 }} role="radiogroup" aria-label="نوع الوقت">
        {(
          [
            ["CLOCK", "وقت محدّد"],
            ["PRAYER", "بالنسبة إلى صلاة"],
            ["NONE", "بلا وقت"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            disabled={m === "PRAYER" && !anchors}
            title={m === "PRAYER" && !anchors ? "يتاح بعد تحديد المدينة في الإعدادات" : undefined}
            className={`${work.pill} ${mode === m ? work.sel : ""}`}
            onClick={() => {
              setMode(m);
              emit({ mode: m });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {!anchors && <div className={work.hint}>أوقات الصلاة تتاح بعد تحديد المدينة في الإعدادات.</div>}

      {mode === "CLOCK" && (
        <div className={styles.timeInputs}>
          <label>
            البداية
            <input
              type="time"
              value={start}
              onChange={(e) => {
                const e2 = shiftEnd(start, end, e.target.value);
                setStart(e.target.value);
                setEnd(e2);
                emit({ start: e.target.value, end: e2 });
              }}
            />
          </label>
          <label>
            النهاية (اختياري)
            <input
              type="time"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                emit({ end: e.target.value });
              }}
            />
          </label>
        </div>
      )}

      {mode === "PRAYER" && (
        <div className={styles.timeInputs}>
          <label>
            الوقت
            <select
              value={before ? "BEFORE" : "AFTER"}
              onChange={(e) => {
                const b = e.target.value === "BEFORE";
                const o = b && offset === "0" ? "15" : offset;
                setBefore(b);
                setOffset(o);
                emit({ before: b, offset: o });
              }}
            >
              <option value="AFTER">بعد</option>
              <option value="BEFORE">قبل</option>
            </select>
          </label>
          <label>
            الصلاة
            <select
              value={prayer}
              onChange={(e) => {
                setPrayer(e.target.value as Prayer);
                emit({ prayer: e.target.value as Prayer });
              }}
            >
              {PRAYERS.map((p) => (
                <option key={p} value={p}>
                  {PRAYER_NAME[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            بكم دقيقة
            <input
              type="number"
              min={0}
              max={OFFSET_MAX}
              value={offset}
              style={{ minWidth: 80, width: 90 }}
              onChange={(e) => {
                setOffset(e.target.value);
                emit({ offset: e.target.value });
              }}
            />
          </label>
          <label>
            المدة بالدقائق (اختياري)
            <input
              type="number"
              min={5}
              max={720}
              value={duration}
              style={{ minWidth: 80, width: 110 }}
              onChange={(e) => {
                setDuration(e.target.value);
                emit({ duration: e.target.value });
              }}
            />
          </label>
        </div>
      )}
      {preview && <div className={work.hint}>اليوم: {clockLabel(preview.startMin)}</div>}
      {problem && <div className={hl.err}>{problem}</div>}
    </div>
  );
}
