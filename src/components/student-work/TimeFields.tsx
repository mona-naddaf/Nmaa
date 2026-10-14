"use client";

import { useState } from "react";
import styles from "./agenda.module.css";
import work from "./work.module.css";
import { clockValue, shiftEnd, timeFromInputs, type AgendaTime } from "@/lib/tracker/agenda";

// An item's optional time in the add / edit forms («الجدول اليومي»): a start
// and an optional end. Both empty = «بلا وقت».

export function useTimeFields(initial: AgendaTime | null) {
  const [start, setStart] = useState(initial ? clockValue(initial.startMin) : "");
  const [end, setEnd] = useState(initial?.durationMin ? clockValue(initial.startMin + initial.durationMin) : "");
  return {
    start,
    end,
    // moving the start moves the end too, keeping the duration
    setStart: (v: string) => {
      setEnd((e) => shiftEnd(start, e, v));
      setStart(v);
    },
    setEnd,
    /** The time to save (null = «بلا وقت»), or what's wrong. */
    read(): { time: AgendaTime | null } | { error: string } {
      if (!start && !end) return { time: null };
      const t = timeFromInputs(start, end);
      return "error" in t ? t : { time: t };
    },
    reset() {
      setStart("");
      setEnd("");
    },
  };
}

export function TimeFields({ fields }: { fields: ReturnType<typeof useTimeFields> }) {
  return (
    <div className={work.field}>
      <span className={work.fieldLabel}>الوقت (اختياري)</span>
      <div className={styles.timeInputs} style={{ marginBottom: 0 }}>
        <label>
          البداية
          <input type="time" value={fields.start} onChange={(e) => fields.setStart(e.target.value)} />
        </label>
        <label>
          النهاية
          <input type="time" value={fields.end} onChange={(e) => fields.setEnd(e.target.value)} />
        </label>
      </div>
      <div className={work.hint}>دون وقت يظهر البند في «بلا وقت».</div>
    </div>
  );
}
