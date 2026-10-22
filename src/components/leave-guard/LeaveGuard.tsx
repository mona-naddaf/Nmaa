"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";

// Saves still on their way to the server. Server actions run one after
// another, so after several quick changes (switches shown at once) some may
// still be waiting; leaving the page then would drop them. While any is
// pending, LeaveGuard warns before leaving: the browser's own prompt on
// reload or close, and — for links inside the app — a short note instead of
// leaving (a second tap leaves anyway). Nothing is ever disabled meanwhile.

let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Counts one save as pending until it settles (fulfilled or not). */
export function trackSave<T>(save: Promise<T>): Promise<T> {
  pending += 1;
  emit();
  return save.finally(() => {
    pending -= 1;
    emit();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePendingSaves(): number {
  return useSyncExternalStore(subscribe, () => pending, () => 0);
}

/**
 * dirty / dirtyNote: also warn while the page holds changes not saved yet
 * (with dirtyNote as the note); unset: pending saves only, as before.
 * you: whoever is looking (her own page, the child herself, or the adult on a
 * child's page), for the note's wording.
 */
export function LeaveGuard({ dirty = false, dirtyNote, you = null }: { dirty?: boolean; dirtyNote?: string; you?: PersonGender } = {}) {
  const y = (m: string, f: string) => pickByPerson(you, { m, f });
  const saves = usePendingSaves();
  // unsaved changes count as one more thing to keep
  const count = saves + (dirty ? 1 : 0);
  const [warned, setWarned] = useState(false);
  // the note goes once everything is saved
  const [seen, setSeen] = useState(count);
  if (seen !== count) {
    setSeen(count);
    if (count === 0 && warned) setWarned(false);
  }

  useEffect(() => {
    if (count === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // older browsers need a value to show their prompt
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== window.location.origin) return;
      if (warned) return;
      e.preventDefault();
      e.stopPropagation();
      setWarned(true);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [count, warned]);

  if (count === 0 || !warned) return null;
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        insetInline: 16,
        bottom: 16,
        zIndex: 50,
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        lineHeight: 1.7,
        maxWidth: 520,
        marginInline: "auto",
      }}
    >
      {saves === 0 && dirtyNote
        ? dirtyNote
        : `يُحفظ تغيير الآن — ${y("انتظر", "انتظري")} لحظة قبل مغادرة الصفحة، أو ${y("اضغط", "اضغطي")} الرابط مرة أخرى للمغادرة دون انتظار.`}
    </div>
  );
}
