"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./mistakes.module.css";
import { hasBasmalaPrefix, splitAyah } from "@/lib/quran-data/words";
import { MISTAKE_TYPES, mistakeTypeLabel, type MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";
import { GAP, spotKey, type DetailFlags } from "@/lib/tajweed/spots";
import { KIND_LABEL, TAJWEED_KINDS } from "@/lib/tajweed/taxonomy";
import type { SheetTarget } from "./TajweedSheet";

// One ayah, word by word, each word a button that opens a small menu of the
// 4 mistake types. Shared by the recording form's WordFlagger and the home
// memorization practice screen. The caller decides what a pick does (keep
// it with the session, or save it right away).

/**
 * Detailed tajweed in an ayah (lib/tajweed), only where the caller turns it
 * on: the words open the letter sheet from their menu, and the gaps between
 * words become tap targets. Without it the ayah is exactly as before.
 */
export interface AyahDetail {
  /** new detailed mistakes may be added (off: earlier ones still show) */
  enabled: boolean;
  flags: DetailFlags;
  previous?: DetailFlags;
  mastered?: Record<string, true>;
  /** the gap after the ayah's last word is recited too (the next ayah is in the range) */
  lastGap: boolean;
  /** the next ayah's first word, for that last gap */
  nextAyahWord: string | null;
  /** the previous ayah's last word when that ayah is recited too (the gap before this ayah) */
  prevAyahLast: { position: number; text: string; marks: string } | null;
  open: (target: SheetTarget) => void;
}

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
  detail,
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
  detail?: AyahDetail;
}) {
  const { openWord, setOpenWord } = menu;
  const split = splitAyah(surahNumber, ayah, text);
  const lastPosition = split.words.length;

  // detailed tajweed: what is on a word's letters, and on the gap after it
  const lettersOf = (flags: DetailFlags | undefined, key: string) =>
    Object.keys(flags ?? {}).filter((k) => k.startsWith(`${key}:L`) && (flags![k]?.length ?? 0) > 0);
  const detailWordClass = (key: string) => {
    if (!detail) return "";
    if (lettersOf(detail.flags, key).length > 0) return styles.detailWord;
    const before = lettersOf(detail.previous, key);
    if (before.length === 0) return "";
    return before.every((k) => detail.mastered?.[k]) ? styles.mastered : styles.detailPrevWord;
  };
  const openSheet = (w: (typeof split.words)[number], mode: SheetTarget["mode"]) => {
    if (!detail) return;
    const prev = split.words[w.position - 2];
    const before = prev
      ? { surah: surahNumber, ayah, wordPosition: prev.position, wordText: prev.text, nextWordText: w.text, marks: prev.marks, ayahEnd: false }
      : detail.prevAyahLast
        ? {
            surah: surahNumber,
            ayah: ayah - 1,
            wordPosition: detail.prevAyahLast.position,
            wordText: detail.prevAyahLast.text,
            nextWordText: w.text,
            marks: detail.prevAyahLast.marks,
            ayahEnd: true,
          }
        : null;
    detail.open({
      surah: surahNumber,
      ayah,
      wordPosition: w.position,
      wordText: w.text,
      nextWordText: split.words[w.position]?.text ?? detail.nextAyahWord,
      marks: w.marks,
      ayahEnd: w.position === lastPosition,
      mode,
      gapAfterOk: w.position !== lastPosition || detail.lastGap,
      before,
    });
  };
  /** The tap target for the gap after a word (detail only). */
  const gapButton = (w: (typeof split.words)[number]) => {
    if (!detail) return null;
    if (w.position === lastPosition && !detail.lastGap) return null;
    const key = spotKey(surahNumber, ayah, w.position, GAP);
    const has = (detail.flags[key]?.length ?? 0) > 0;
    const before = (detail.previous?.[key]?.length ?? 0) > 0;
    if (!detail.enabled && !has && !before) return null;
    const state = has ? styles.gapFlagged : before ? (detail.mastered?.[key] ? styles.gapMastered : styles.gapPrevious) : "";
    return (
      <button
        type="button"
        className={`${styles.gap} ${state}`}
        onClick={() => openSheet(w, { target: "GAP" })}
        aria-label={has ? "بين كلمتين — عليه خطأ" : before ? "بين كلمتين — عليه خطأ سابق" : "بين كلمتين"}
      />
    );
  };
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
              className={`${styles.word} ${wordClass(key, type)} ${detailWordClass(key)}`}
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
            {w.marks && <span className={styles.mark}>{w.marks}</span>}
            {w.position !== lastPosition && gapButton(w)}{" "}
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
                {detail?.enabled && (
                  <span className={styles.menuDetail}>
                    <span className={styles.menuNote}>تجويد مفصّل: على حرف من الكلمة</span>
                    <span className={styles.menuKinds}>
                      {TAJWEED_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="menuitem"
                          className={`${styles.menuItem} ${styles.menuKind}`}
                          onClick={() => {
                            setOpenWord(null);
                            openSheet(w, { target: "LETTER", kind: k });
                          }}
                        >
                          {KIND_LABEL[k]}
                        </button>
                      ))}
                    </span>
                  </span>
                )}
                {detail && !detail.enabled && lettersOf(detail.previous, key).length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuRemove}
                    onClick={() => {
                      setOpenWord(null);
                      openSheet(w, { target: "LETTER", kind: "HUKM" });
                    }}
                  >
                    أخطاء سابقة على حروفها
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
      {detail && split.words.length > 0 && gapButton(split.words[lastPosition - 1])}
      {showNumber && " "}
    </>
  );
}
