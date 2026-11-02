"use client";

import { useCallback, useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import css from "@/components/excuse/excuse.module.css";
import { ExcuseBar } from "@/components/excuse/ExcuseBar";
import type { TrackerExcuse } from "@/lib/excuse/subject";
import { EXCUSE_PARENT_HINT, EXCUSE_PARENT_SWITCH, EXCUSE_SECTION } from "@/lib/excuse/texts";
import { endStudentExcuseAction, setExcuseParentVisibleAction, settleStudentExcuseAction, startStudentExcuseAction } from "./excuse-actions";

/** G9: «العذر» under today's attendance: the button or her line, its record, and her last excuse. Only for staff who may act on it. */
export function StudentExcusePanel({ studentId, excuse, last }: { studentId: string; excuse: TrackerExcuse; last: string | null }) {
  const onSettle = useCallback(() => settleStudentExcuseAction({ studentId }), [studentId]);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className={hl.muted} style={{ fontSize: 12.5, marginBottom: 4 }}>
        {EXCUSE_SECTION}
      </div>
      <ExcuseBar
        excuses={excuse.excuses}
        you={excuse.you}
        self={false}
        startedBy={excuse.startedBy}
        onStart={(at) => startStudentExcuseAction({ studentId, at })}
        onEnd={(at) => endStudentExcuseAction({ studentId, at })}
        onSettle={onSettle}
      />
      {last && <div className={css.log}>{last}</div>}
    </div>
  );
}

/** G5: whether her parents see her excuse (the supervisor only; off by default). */
export function ParentExcuseToggle({ studentId, initial }: { studentId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function set(next: boolean) {
    setOn(next);
    setError(null);
    start(async () => {
      const r = await setExcuseParentVisibleAction({ studentId, on: next }).catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" }));
      if (r.error) {
        setOn(!next);
        setError(r.error);
      }
    });
  }
  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, cursor: "pointer" }}>
        <input type="checkbox" checked={on} disabled={pending} onChange={(e) => set(e.target.checked)} />
        {EXCUSE_PARENT_SWITCH}
      </label>
      <div className={css.hint}>{EXCUSE_PARENT_HINT}</div>
      {error && (
        <div className={hl.err} role="alert" style={{ marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
