"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./mistakes.module.css";
import { hasBasmalaPrefix, splitAyah } from "@/lib/quran-data/words";
import { MISTAKE_TYPES, mistakeTypeLabel, type MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";

// One ayah, word by word, each word a button that opens a small menu of the
// 4 mistake types. Shared by the recording form's WordFlagger and the home
// memorization practice screen. The caller decides what a pick does (keep
// it with the session, or save it right away).

/** "surah:ayah:wordPosition" → the mistake type flagged on that word. */
export type WordFlags = Record<string, MistakeType>;

export const flagKey = (surah: number, ayah: number, position: number) => `${surah}:${ayah}:${position}`;

export const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export const TYPE_CLASS: Record<MistakeType, string> = {
  PRONUNCIATION: styles.tPronunciation,
  TAJWEED: styles.tTajweed,
  FORGOT_PROMPTED: styles.tForgot,
  HESITATED_SELF_CORRECTED: styles.tHesitated,
};

/** Which word's menu is open, closed on an outside click or Escape. */
export function useWordMenu() {
  const [openWord, setOpenWord] = useState<string | null>(null);
  useEffect(() => {
    if (!openWord) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-word="${openWord}"]`)) setOpenWord(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenWord(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openWord]);
  return { openWord, setOpenWord };
}

export function FlaggableAyah({
  surahNumber,
  ayah,
  text,
  flags,
  menu,
  onFlag,
  subject,
  showNumber = true,
  after,
  previous,
  mastered,
  onToggleMastered,
}: {
  surahNumber: number;
  ayah: number;
  // the ayah's full text as bundled
  text: string;
  flags: WordFlags;
  menu: ReturnType<typeof useWordMenu>;
  // a type picked for the word, or null to remove its mark
  onFlag: (key: string, type: MistakeType | null) => void;
  subject: RecitationSubject;
  // the «﴿n﴾» ayah number after the words
  showNumber?: boolean;
  // anything to show right after the ayah number (e.g. a note marker)
  after?: ReactNode;
  // the course's recording form only: her earlier unresolved mistakes, shown
  // before anything is marked; a word's menu then also offers «تم الإتقان»
  // (held in `mastered` until the session is saved)
  previous?: WordFlags;
  mastered?: Record<string, true>;
  onToggleMastered?: (key: string) => void;
}) {
  const { openWord, setOpenWord } = menu;
  const split = splitAyah(surahNumber, ayah, text);
  const wordClass = (key: string, type: MistakeType | undefined) => {
    if (type) return `${styles.flagged} ${TYPE_CLASS[type]}`;
    const before = previous?.[key];
    if (!before) return "";
    return mastered?.[key] ? styles.mastered : `${styles.previous} ${TYPE_CLASS[before]}`;
  };
  return (
    <>
      {split.basmala && hasBasmalaPrefix(surahNumber, ayah) && <div className={styles.basmala}>{split.basmala}</div>}
      {split.leadingMarks && <span className={styles.mark}>{split.leadingMarks} </span>}
      {split.words.map((w) => {
        const key = flagKey(surahNumber, ayah, w.position);
        const type = flags[key];
        const before = previous?.[key];
        const isMastered = !!(before && mastered?.[key]);
        return (
          <span key={w.position} className={styles.wordWrap} data-word={key}>
            <button
              type="button"
              className={`${styles.word} ${wordClass(key, type)}`}
              onClick={() => setOpenWord(openWord === key ? null : key)}
              aria-haspopup="menu"
              aria-expanded={openWord === key}
              title={
                type
                  ? mistakeTypeLabel(type, subject)
                  : before
                    ? isMastered
                      ? "تم الإتقان (يُحذف الخطأ السابق عند حفظ التسميع)"
                      : `خطأ سابق: ${mistakeTypeLabel(before, subject)}`
                    : undefined
              }
            >
              {w.text}
            </button>
            {w.marks && <span className={styles.mark}>{w.marks}</span>}{" "}
            {openWord === key && (
              <span className={styles.menu} role="menu">
                {before && (
                  <span className={styles.menuNote}>
                    {isMastered ? "تم الإتقان — يُحذف الخطأ السابق عند حفظ التسميع" : `خطأ سابق: ${mistakeTypeLabel(before, subject)}`}
                  </span>
                )}
                {MISTAKE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="menuitemradio"
                    aria-checked={type === t}
                    className={`${styles.menuItem} ${TYPE_CLASS[t]} ${type === t ? styles.menuSel : ""}`}
                    onClick={() => {
                      // wrong again this session: no longer «تم الإتقان»
                      if (isMastered) onToggleMastered?.(key);
                      onFlag(key, t);
                      setOpenWord(null);
                    }}
                  >
                    {mistakeTypeLabel(t, subject)}
                  </button>
                ))}
                {type && (
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuRemove}
                    onClick={() => {
                      onFlag(key, null);
                      setOpenWord(null);
                    }}
                  >
                    إزالة التحديد
                  </button>
                )}
                {before && onToggleMastered && !type && (
                  <button
                    type="button"
                    role="menuitem"
                    className={isMastered ? styles.menuRemove : styles.menuMastered}
                    onClick={() => {
                      onToggleMastered(key);
                      setOpenWord(null);
                    }}
                  >
                    {isMastered ? "التراجع عن «تم الإتقان»" : "تم الإتقان ✓"}
                  </button>
                )}
              </span>
            )}
          </span>
        );
      })}
      {showNumber && <span className={styles.ayahNum}>﴿{toArabicDigits(ayah)}﴾</span>}
      {after}
      {showNumber && " "}
    </>
  );
}
