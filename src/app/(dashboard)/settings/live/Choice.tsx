"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SavedNote } from "@/components/nudge/SavedNote";
import { pointTo } from "@/components/nudge/nudge";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import styles from "../settings.module.css";

// The course settings' choices, saved at once (COURSE_GUIDE_EMAILS courses,
// until they open to everyone; the others keep the cards one folder up):
// pressing a choice shows it chosen straight away and saves it in the
// background; «تم الحفظ ✓» fades in after it; a failure puts the old choice
// back with a short line. A choice that needs another switch first never
// looks dead: it stays faded with the reason as its tooltip, and pressing it
// shows that reason and takes her to the switch it needs.

export const SAVE_FAILED = "تعذّر حفظ الإعداد، يُرجى المحاولة مرة أخرى";

export type SaveResult = { error?: string } | void | undefined;

/** One saved value, chosen optimistically: the value shown, and a save that reverts it on failure. */
export function useLiveSave<T>(saved: T) {
  const router = useRouter();
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);
  const [, start] = useTransition();
  // a new value from the server (a refresh, «تفعيل الآن» elsewhere): it follows
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setValue(saved);
  }
  const save = (next: T, request: () => Promise<SaveResult>) => {
    const before = value;
    setValue(next);
    setError(null);
    setStamp(0);
    start(async () => {
      const r = await trackSave(request()).catch(() => ({ error: SAVE_FAILED }));
      if (r && r.error) {
        setValue(before);
        setError(r.error === "failed" ? SAVE_FAILED : r.error);
        return;
      }
      setStamp(Date.now());
      router.refresh();
    });
  };
  return { value, setValue, error, setError, stamp, save };
}

/** Where a choice that needs another switch sends her: the reason, and the id of that switch's row. */
export type Needs = { why: string; at: string };

export function Choice<T extends string | number | boolean | null>({
  label,
  options,
  value,
  onChoose,
  needs,
  stamp,
  error,
}: {
  // the setting's name, for screen readers
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChoose: (next: T) => void;
  needs?: Needs | null;
  stamp: number;
  error: string | null;
}) {
  const [told, setTold] = useState(false);
  const lineId = useId();
  const press = (next: T) => {
    if (needs) {
      setTold(true);
      // to the switch it needs: its first choice takes the focus
      const row = document.getElementById(needs.at);
      pointTo(row?.querySelector<HTMLElement>("button") ?? row);
      return;
    }
    if (next !== value) onChoose(next);
  };
  return (
    <div className={styles.optionPills} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`${styles.optionPill} ${styles.pillBtn} ${value === o.value ? styles.sel : ""}`}
          aria-pressed={value === o.value}
          {...(needs ? { "aria-disabled": true, title: needs.why, "aria-describedby": lineId } : {})}
          onClick={() => press(o.value)}
        >
          {o.label}
        </button>
      ))}
      <SavedNote stamp={stamp} className={styles.savedNote} />
      {needs && told && (
        <div id={lineId} className={styles.err} role="status">
          {needs.why}
        </div>
      )}
      {error && (
        <div className={styles.err} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export const ON_OFF = [
  { value: true, label: "مفعّل" },
  { value: false, label: "غير مفعّل" },
] as const;

/** A setting row with an on/off (or other) choice, saved at once. */
export function SettingRow<T extends string | number | boolean | null>({
  id,
  title,
  desc,
  saved,
  options,
  request,
  needs,
  last,
  state,
  children,
}: {
  // the row's id, for a choice elsewhere that needs this one
  id?: string;
  title?: string;
  desc: React.ReactNode;
  saved: T;
  options: readonly { value: T; label: string }[];
  request: (next: T) => Promise<SaveResult>;
  needs?: Needs | null;
  last?: boolean;
  // the card's own useLiveSave for this row, when other rows follow its value
  state?: ReturnType<typeof useLiveSave<T>>;
  children?: React.ReactNode;
}) {
  const own = useLiveSave(saved);
  const s = state ?? own;
  return (
    <div
      id={id}
      className={`${styles.settingRow} ${needs ? styles.needsRow : ""}`}
      style={last ? { borderBottom: "none" } : undefined}
    >
      <div className={styles.settingText}>
        {title && <div className={styles.settingTitle}>{title}</div>}
        <div className={styles.settingDesc}>{desc}</div>
        {children}
      </div>
      <Choice
        label={title ?? ""}
        options={[...options]}
        value={s.value}
        needs={needs}
        stamp={s.stamp}
        error={s.error}
        onChoose={(next) => s.save(next, () => request(next))}
      />
    </div>
  );
}
