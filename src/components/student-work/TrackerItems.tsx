"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./items.module.css";
import agendaStyles from "./agenda.module.css";
import { daysLabel } from "@/lib/tracker/rules";
import { useGuideTarget } from "@/components/guide/targets";
import type { GuideTarget } from "@/lib/guide/help/targets";

// The «⚙ البنود» menu on «جدول المتابعة» and the compact rows of «إدارة
// البنود». Shared by the course student and «رفيق الحفظ»; each page decides
// which entries the user may see (the server actions check again).

// guide: the guide's name for the entry (src/components/guide/targets.tsx)
export type MenuEntry = ({ label: string; onSelect: () => void } | { label: string; href: string }) & { guide?: GuideTarget };

/** A small «⚙ البنود» button opening a menu of item views. */
export function ItemsMenu({ entries }: { entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const t = useGuideTarget();

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
      <button type="button" className={styles.pill} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} {...t("tracker.menu")}>
        ⚙ البنود
      </button>
      {/* always mounted so it can fade out; inert (and hidden) while closed */}
      <div className={`${styles.menu} ${open ? styles.open : ""}`} role="menu" inert={!open} aria-hidden={!open}>
        {entries.map((e) =>
          "href" in e ? (
            <Link key={e.label} href={e.href} role="menuitem" className={styles.menuItem} {...(e.guide && t(e.guide))}>
              {e.label}
            </Link>
          ) : (
            <button
              key={e.label}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              {...(e.guide && t(e.guide))}
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
    </div>
  );
}

/**
 * The page's one header row: «جدول اليوم», then small pills — «أمس» (only
 * with «الجدول اليومي», when onYesterday is given), «المحصّلات» (when
 * enabled) and the «⚙ البنود» menu. They wrap under the heading on narrow screens.
 */
export function TrackerHeader({
  yesterday = false,
  onYesterday,
  summaryHref,
  menu,
}: {
  yesterday?: boolean;
  onYesterday?: () => void;
  summaryHref?: string;
  menu: MenuEntry[];
}) {
  const t = useGuideTarget();
  return (
    <div className={styles.header}>
      <h2 className={styles.heading}>🗓️ جدول اليوم</h2>
      <div className={styles.pills}>
        {onYesterday && (
          <button type="button" className={`${styles.pill} ${yesterday ? styles.sel : ""}`} aria-pressed={yesterday} onClick={onYesterday}>
            أمس
            <span className={styles.chev} aria-hidden>
              ▾
            </span>
          </button>
        )}
        {summaryHref && (
          <Link href={summaryHref} className={styles.pill} {...t("tracker.summary")}>
            📊 المحصّلات
          </Link>
        )}
        <ItemsMenu entries={menu} />
      </div>
    </div>
  );
}

/** The title of an item view, with the way back to the day. */
export function ViewBar({ title, onBack, children }: { title: string; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className={styles.viewBar}>
      <button type="button" className={`${styles.backBtn} pressable`} onClick={onBack}>
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
  target,
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
  // the guide's name for the row (src/components/guide/targets.tsx): undefined adds nothing
  target?: { "data-guide": string };
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.row} {...target}>
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
