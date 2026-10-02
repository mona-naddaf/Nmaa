"use client";

import { useId, useState, useSyncExternalStore } from "react";
import styles from "./collapsible.module.css";

export type CollapsibleTagTone = "on" | "off" | "info";

// Remembered open/closed state (persistKey), per device in localStorage.
// Any storage failure (private mode, blocked storage, …) falls back to the
// default and the in-page state.
const STORAGE_PREFIX = "namaa.section.";
const CHANGE_EVENT = "namaa-section-change";

function readStored(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + key);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, open ? "1" : "0");
    // same-tab listeners (the storage event only reaches other tabs)
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // not remembered; the in-page state still works
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * A card whose header toggles its body. Starts collapsed unless
 * defaultOpen. With persistKey, the last open/closed choice is remembered
 * on this device and applies everywhere the same key is used (e.g. every
 * student's page). The body stays mounted while hidden, so anything typed
 * inside survives collapsing, and a server refresh (after a server action)
 * keeps the card open. tag = a short status shown in the header.
 */
export function Collapsible({
  title,
  tag,
  tagTone = "info",
  defaultOpen = false,
  persistKey,
  id,
  children,
}: {
  title: React.ReactNode;
  tag?: React.ReactNode;
  tagTone?: CollapsibleTagTone;
  defaultOpen?: boolean;
  persistKey?: string;
  // anchor for links to this section
  id?: string;
  children: React.ReactNode;
}) {
  // null until clicked on this page; then it wins over storage, so a failed
  // write can never stop the toggle from working
  const [clicked, setClicked] = useState<boolean | null>(null);
  // null on the server and during hydration, so the first render matches
  const stored = useSyncExternalStore(
    subscribe,
    () => (persistKey ? readStored(persistKey) : null),
    () => null,
  );
  const open = clicked ?? stored ?? defaultOpen;
  const bodyId = useId();

  function toggle() {
    const next = !open;
    setClicked(next);
    if (persistKey) writeStored(persistKey, next);
  }

  return (
    <section className={`${styles.box} ${open ? styles.open : ""}`} id={id}>
      <h2 className={styles.heading}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <span className={styles.dot} aria-hidden />
          <span className={styles.title}>{title}</span>
          {tag !== undefined && tag !== null && tag !== "" && (
            <span className={`${styles.tag} ${styles[tagTone]}`}>{tag}</span>
          )}
          <span className={styles.chevron} aria-hidden />
        </button>
      </h2>
      <div id={bodyId} className={styles.body} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
