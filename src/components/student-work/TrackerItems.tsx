"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./items.module.css";
import agendaStyles from "./agenda.module.css";
import { daysLabel } from "@/lib/tracker/rules";

// The «⚙ البنود» menu on «جدول المتابعة» and the compact rows of «إدارة
// البنود». Shared by the course student and «رفيق الحفظ»; each page decides
// which entries the user may see (the server actions check again).

export type MenuEntry = { label: string; onSelect: () => void } | { label: string; href: string };

/** A small «⚙ البنود» button opening a menu of item views. */
export function ItemsMenu({ entries }: { entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // closes on a tap outside it or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (entries.length === 0) return null;
  return (
    <div className={styles.menuBox} ref={box}>
      <button type="button" className={styles.menuBtn} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        ⚙ البنود
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {entries.map((e) =>
            "href" in e ? (
              <Link key={e.label} href={e.href} role="menuitem" className={styles.menuItem}>
                {e.label}
              </Link>
            ) : (
              <button
                key={e.label}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  setOpen(false);
                  e.onSelect();
                }}
              >
                {e.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** The title of an item view, with the way back to the day. */
export function ViewBar({ title, onBack, children }: { title: string; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className={styles.viewBar}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        → العودة إلى الجدول
      </button>
      <span className={styles.viewTitle}>{title}</span>
      {children}
    </div>
  );
}

export const pointsLabel = (n: number) => (n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? `${n} درجات` : `${n} درجة`);

/**
 * One item in «إدارة البنود»: its name, then small chips (status or points,
 * days, time), and small icon buttons. Its form or delete confirmation, when
 * open, goes in children, under the row.
 */
export function CompactRow({
  title,
  status,
  points,
  days,
  time,
  onEdit,
  editLabel = "تعديل",
  onDelete,
  muted = false,
  children,
}: {
  title: string;
  // shown instead of the points (e.g. «بانتظار الاعتماد»)
  status?: string;
  points?: number | null;
  days: number;
  // the item's time («الجدول اليومي» on)
  time?: string;
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowBody}>
          <div className={`${styles.rowTitle} ${muted ? styles.muted : ""}`}>{title}</div>
          <div className={styles.rowMeta}>
            {status ? <span className={styles.status}>{status}</span> : points != null && <span className={styles.points}>{pointsLabel(points)}</span>}
            {time && <span className={agendaStyles.timeChip}>{time}</span>}
            <span>{daysLabel(days)}</span>
          </div>
        </div>
        {onEdit && (
          <button type="button" className={styles.iconBtn} aria-label={`${editLabel} «${title}»`} title={editLabel} onClick={onEdit}>
            ✎
          </button>
        )}
        {onDelete && (
          <button type="button" className={`${styles.iconBtn} ${styles.danger}`} aria-label={`حذف «${title}»`} title="حذف" onClick={onDelete}>
            🗑
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
