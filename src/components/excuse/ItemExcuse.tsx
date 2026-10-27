"use client";

import { useId, useState } from "react";
import work from "@/components/student-work/work.module.css";
import hl from "@/components/home-log/home-log.module.css";
import css from "./excuse.module.css";
import { pointTo } from "@/components/nudge/nudge";
import { EXCUSE_LIMITS, validateItemExcuse, type ExcuseMode } from "@/lib/excuse/rules";
import {
  EXCUSE_SKIP_TODAY,
  excuseInsteadOf,
  ITEM_EXCUSE_ALT_LABEL,
  ITEM_EXCUSE_ALT_PLACEHOLDER,
  ITEM_EXCUSE_FIELD,
  ITEM_EXCUSE_HINT,
  ITEM_EXCUSE_OPTIONS,
} from "@/lib/excuse/texts";

// «أيام العذر» on an item: its «في أيام العذر» field in the item form, and
// the small marks the tracker shows. Only rendered for someone who may see
// the excuse.

/** D1: «بدل «صلاة العصر»» under an item shown by its alternative. */
export function ExcuseWas({ title }: { title: string }) {
  return <small className={css.was}>{excuseInsteadOf(title)}</small>;
}

/** D2: in place of the tick of an item not counted today. */
export function SkipNote() {
  return <span className={css.skipNote}>{EXCUSE_SKIP_TODAY}</span>;
}

export const excuseCss = css;

type You = "MALE" | "FEMALE";

/** The field's state; read() checks it (message + focus on the alternative when empty). */
export function useItemExcuse(initial: { excuseMode?: ExcuseMode; excuseAltTitle?: string | null } | undefined, you: You) {
  const id = useId();
  const [mode, setMode] = useState<ExcuseMode>(initial?.excuseMode ?? "NONE");
  const [alt, setAlt] = useState(initial?.excuseAltTitle ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const read = (): { mode: ExcuseMode; alt: string } | null => {
    const v = validateItemExcuse(mode, alt, you);
    if ("error" in v) {
      setProblem(v.error);
      pointTo(document.getElementById(id));
      return null;
    }
    setProblem(null);
    return { mode, alt };
  };
  return { mode, setMode, alt, setAlt, problem, setProblem, id, read };
}

export type ItemExcuseState = ReturnType<typeof useItemExcuse>;

/** B1–B7: «في أيام العذر»: يُحسب كالمعتاد · لا يُحسب · له بديل (+ the alternative). */
export function ItemExcuseField({ field }: { field: ItemExcuseState }) {
  return (
    <div className={work.field}>
      <span className={work.fieldLabel}>{ITEM_EXCUSE_FIELD}</span>
      <div className={work.pills} role="group" aria-label={ITEM_EXCUSE_FIELD}>
        {(["NONE", "SKIP", "ALT"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`${work.pill} ${field.mode === m ? work.sel : ""}`}
            aria-pressed={field.mode === m}
            onClick={() => {
              field.setMode(m);
              field.setProblem(null);
            }}
          >
            {ITEM_EXCUSE_OPTIONS[m]}
          </button>
        ))}
      </div>
      {field.mode !== "NONE" && <div className={css.hint}>{ITEM_EXCUSE_HINT[field.mode]}</div>}
      {field.mode === "ALT" && (
        <div className={css.altField}>
          <label htmlFor={field.id} className={work.fieldLabel}>
            {ITEM_EXCUSE_ALT_LABEL}
          </label>
          <input
            id={field.id}
            className={work.input}
            value={field.alt}
            maxLength={EXCUSE_LIMITS.altTitleMax}
            placeholder={ITEM_EXCUSE_ALT_PLACEHOLDER}
            onChange={(e) => {
              field.setAlt(e.target.value);
              field.setProblem(null);
            }}
          />
        </div>
      )}
      {field.problem && (
        <div className={hl.err} role="alert" style={{ marginTop: 6 }}>
          {field.problem}
        </div>
      )}
    </div>
  );
}
