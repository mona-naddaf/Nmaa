"use client";

import { useId, useState } from "react";
import styles from "./collapsible.module.css";

export type CollapsibleTagTone = "on" | "off" | "info";

/**
 * A card whose header toggles its body. Starts collapsed unless
 * defaultOpen. The body stays mounted while hidden, so anything typed inside
 * survives collapsing, and a server refresh (after a server action) keeps the
 * card open. tag = a short status shown in the header («مفعّل», a count…).
 */
export function Collapsible({
  title,
  tag,
  tagTone = "info",
  defaultOpen = false,
  id,
  children,
}: {
  title: React.ReactNode;
  tag?: React.ReactNode;
  tagTone?: CollapsibleTagTone;
  defaultOpen?: boolean;
  // anchor for links to this section
  id?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={`${styles.box} ${open ? styles.open : ""}`} id={id}>
      <h2 className={styles.heading}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
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
