"use client";

import { useState, useTransition } from "react";
import styles from "./mistakes.module.css";
import { quranFont } from "./quran-font";
import { TYPE_CLASS } from "./WordFlagger";
import { SURAH_NAME } from "@/lib/quran-data";
import { mistakeTypeLabel, type ActiveMistake } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";

// Arabic number agreement: مرتين، 3–10 مرات، 11+ مرة
const timesText = (n: number) => (n === 2 ? "تكرّر مرتين" : `تكرّر ${n} ${n <= 10 ? "مرات" : "مرة"}`);

const keyOf = (m: ActiveMistake) => `${m.surahNumber}:${m.ayah}:${m.wordPosition}`;

/**
 * A student's unresolved flagged words, grouped by surah (already sorted by
 * getActiveMistakes). With `onResolve` each row gets a resolve action
 * (student page); without it the list is read-only (parent view).
 */
export function MistakesList({
  mistakes,
  subject,
  onResolve,
}: {
  mistakes: ActiveMistake[];
  // whose mistakes: a course group's student, or the learner herself
  subject: RecitationSubject;
  onResolve?: (m: ActiveMistake) => Promise<{ error: string } | { ok: true }>;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = mistakes.filter((m) => !hidden.has(keyOf(m)));
  const groups: { surahNumber: number; items: ActiveMistake[] }[] = [];
  for (const m of visible) {
    const last = groups[groups.length - 1];
    if (last?.surahNumber === m.surahNumber) last.items.push(m);
    else groups.push({ surahNumber: m.surahNumber, items: [m] });
  }

  function resolve(m: ActiveMistake) {
    if (!onResolve) return;
    const key = keyOf(m);
    setError(null);
    setHidden((h) => new Set(h).add(key)); // optimistic
    startTransition(async () => {
      const result = await onResolve(m);
      if ("error" in result) {
        setError(result.error);
        setHidden((h) => {
          const next = new Set(h);
          next.delete(key);
          return next;
        });
      }
    });
  }

  if (visible.length === 0) return null;

  return (
    <div className={styles.list}>
      {error && <div className={styles.listError}>{error}</div>}
      {groups.map((g) => (
        <div key={g.surahNumber} className={styles.group}>
          <div className={styles.groupHead}>سورة {SURAH_NAME[g.surahNumber]}</div>
          {g.items.map((m) => (
            <div key={keyOf(m)} className={styles.row}>
              <span className={`${quranFont.className} ${styles.rowWord}`} lang="ar">
                {m.wordText}
              </span>
              <span className={styles.rowMeta}>
                <span className={styles.rowLoc}>
                  آية {m.ayah}
                </span>
                <span className={`${styles.typeBadge} ${TYPE_CLASS[m.type]}`}>{mistakeTypeLabel(m.type, subject)}</span>
                <span className={styles.rowDate}>
                  منذ <bdi dir="ltr">{m.firstFlagged}</bdi>
                  {m.count > 1 && <span className={styles.rowCount}> · {timesText(m.count)}</span>}
                </span>
              </span>
              {onResolve && (
                <button type="button" className={styles.resolveBtn} onClick={() => resolve(m)}>
                  تم الإتقان ✓
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
