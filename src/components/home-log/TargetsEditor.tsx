"use client";

import { useState, useTransition } from "react";
import styles from "./home-log.module.css";
import { HOME_TAP_ICON, HOME_TAP_KINDS, HOME_TAP_LABEL, type HomeTargets, type HomeTapKind } from "@/lib/home-log/rules";

const FIELD: Record<HomeTapKind, keyof HomeTargets> = { LISTEN: "listen", REPEAT: "repeat", RECITE: "recite" };

// Three target inputs (listen / repeat / recite to someone) with Save, and an
// optional "back to defaults". Used in settings and on the staff student page.
export function TargetsEditor({
  initial,
  onSave,
  onReset,
  resetLabel,
  saveLabel = "حفظ الأهداف",
}: {
  initial: HomeTargets;
  onSave: (t: HomeTargets) => Promise<{ error?: string }>;
  onReset?: () => Promise<{ error?: string }>;
  resetLabel?: string;
  saveLabel?: string;
}) {
  const [values, setValues] = useState<Record<keyof HomeTargets, string>>({
    listen: String(initial.listen),
    repeat: String(initial.repeat),
    recite: String(initial.recite),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await action();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "تم الحفظ ✓" });
    });
  }

  return (
    <div>
      <div className={styles.targetInputs}>
        {HOME_TAP_KINDS.map((k) => (
          <label key={k} className={styles.targetInput}>
            <span>
              {HOME_TAP_ICON[k]} {HOME_TAP_LABEL[k]}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={values[FIELD[k]]}
              onChange={(e) => setValues({ ...values, [FIELD[k]]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className={styles.editorButtons}>
        <button
          type="button"
          className={styles.smallBtn}
          disabled={pending}
          onClick={() => run(() => onSave({ listen: Number(values.listen), repeat: Number(values.repeat), recite: Number(values.recite) }))}
        >
          {pending ? "جارٍ الحفظ…" : saveLabel}
        </button>
        {onReset && (
          <button type="button" className={styles.linkBtn} disabled={pending} onClick={() => run(onReset)}>
            {resetLabel}
          </button>
        )}
        {msg && <span className={msg.ok ? styles.ok : styles.err}>{msg.text}</span>}
      </div>
    </div>
  );
}
