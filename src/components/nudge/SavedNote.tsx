"use client";

import { useEffect, useState } from "react";
import styles from "./saved-note.module.css";

/**
 * «تم الحفظ ✓» for a change saved without a «حفظ» button: shown when `stamp`
 * changes to a new non-zero value (a successful save), then fades out after
 * about two seconds.
 */
export function SavedNote({ stamp, className }: { stamp: number; className?: string }) {
  const [gone, setGone] = useState(0);
  useEffect(() => {
    if (!stamp) return;
    const t = window.setTimeout(() => setGone(stamp), 2400);
    return () => window.clearTimeout(t);
  }, [stamp]);
  return (
    <span role="status" className={className}>
      {stamp && stamp !== gone ? (
        <span key={stamp} className={styles.note}>
          تم الحفظ ✓
        </span>
      ) : null}
    </span>
  );
}
