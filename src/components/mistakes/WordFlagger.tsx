"use client";

import { Fragment, useEffect, useState } from "react";
import styles from "./mistakes.module.css";
import { quranFont } from "./quran-font";
import { hasBasmalaPrefix, splitAyah } from "@/lib/quran-data/words";
import { MISTAKE_TYPES, mistakeTypeLabel, type MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";

/** "surah:ayah:wordPosition" → the mistake type flagged on that word. */
export type WordFlags = Record<string, MistakeType>;

export const flagKey = (surah: number, ayah: number, position: number) => `${surah}:${ayah}:${position}`;

// one fetch per surah per page load; the text itself is cached by the browser
const surahCache = new Map<number, Promise<string[]>>();
function loadSurah(surah: number): Promise<string[]> {
  let p = surahCache.get(surah);
  if (!p) {
    p = fetch(`/api/quran-text/${surah}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { ayahs: string[] }) => d.ayahs);
    p.catch(() => surahCache.delete(surah));
    surahCache.set(surah, p);
  }
  return p;
}

// Arabic number agreement: 1 كلمة، 2 كلمتان، 3–10 كلمات، 11+ كلمة
function flaggedWordsText(n: number): string {
  if (n === 1) return "كلمة واحدة محدّدة";
  if (n === 2) return "كلمتان محدّدتان";
  return `${n} ${n <= 10 ? "كلمات محدّدة" : "كلمة محدّدة"}`;
}

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export const TYPE_CLASS: Record<MistakeType, string> = {
  PRONUNCIATION: styles.tPronunciation,
  TAJWEED: styles.tTajweed,
  FORGOT_PROMPTED: styles.tForgot,
  HESITATED_SELF_CORRECTED: styles.tHesitated,
};

/**
 * The recitation form's word-level mistake picker: the Quran text of the
 * entered range, word by word; tapping a word opens a small menu of the 3
 * mistake types. Long ranges start collapsed so logging a whole-surah review
 * doesn't render thousands of words unasked.
 */
export function WordFlagger({
  surahNumber,
  fromAyah,
  toAyah,
  startCollapsed,
  flags,
  onChange,
  subject,
}: {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  startCollapsed: boolean;
  flags: WordFlags;
  onChange: (flags: WordFlags) => void;
  // whose mistakes: a course group's student, or the learner herself
  subject: RecitationSubject;
}) {
  const [ayahs, setAyahs] = useState<{ surah: number; text: string[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null); // null = automatic
  const [openWord, setOpenWord] = useState<string | null>(null);

  const open = expanded ?? !startCollapsed;
  const loaded = ayahs?.surah === surahNumber ? ayahs.text : null;

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    loadSurah(surahNumber).then(
      (text) => {
        if (cancelled) return;
        setAyahs({ surah: surahNumber, text });
        setLoadError(false);
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, loaded, surahNumber]);

  // close the type menu on outside click / Escape
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

  const flaggedHere = Object.keys(flags).filter((k) => {
    const [s, a] = k.split(":").map(Number);
    return s === surahNumber && a >= fromAyah && a <= toAyah;
  }).length;

  function setFlag(key: string, type: MistakeType | null) {
    const next = { ...flags };
    if (type) next[key] = type;
    else delete next[key];
    onChange(next);
    setOpenWord(null);
  }

  return (
    <div className={styles.flagger}>
      <button type="button" className={styles.flaggerHead} onClick={() => setExpanded(!open)} aria-expanded={open}>
        <span>🔖 تحديد الأخطاء على مستوى الكلمة (اختياري)</span>
        <span className={styles.flaggerCount}>
          {flaggedHere > 0 ? flaggedWordsText(flaggedHere) : ""}
          <span className={styles.chevron}>{open ? "▴" : "▾"}</span>
        </span>
      </button>

      {open && (
        <>
          {loadError ? (
            <div className={styles.flaggerNote}>تعذّر تحميل نص السورة — يمكن حفظ التسميع بدون تحديد الكلمات.</div>
          ) : !loaded ? (
            <div className={styles.flaggerNote}>جارٍ تحميل النص...</div>
          ) : (
            <div className={`${quranFont.className} ${styles.quranText}`} dir="rtl" lang="ar">
              {Array.from({ length: toAyah - fromAyah + 1 }, (_, i) => fromAyah + i).map((ayah) => {
                const split = splitAyah(surahNumber, ayah, loaded[ayah - 1] ?? "");
                return (
                  <Fragment key={ayah}>
                    {split.basmala && hasBasmalaPrefix(surahNumber, ayah) && (
                      <div className={styles.basmala}>{split.basmala}</div>
                    )}
                    {split.leadingMarks && <span className={styles.mark}>{split.leadingMarks} </span>}
                    {split.words.map((w) => {
                      const key = flagKey(surahNumber, ayah, w.position);
                      const type = flags[key];
                      return (
                        <span key={w.position} className={styles.wordWrap} data-word={key}>
                          <button
                            type="button"
                            className={`${styles.word} ${type ? `${styles.flagged} ${TYPE_CLASS[type]}` : ""}`}
                            onClick={() => setOpenWord(openWord === key ? null : key)}
                            aria-haspopup="menu"
                            aria-expanded={openWord === key}
                            title={type ? mistakeTypeLabel(type, subject) : undefined}
                          >
                            {w.text}
                          </button>
                          {w.marks && <span className={styles.mark}>{w.marks}</span>}{" "}
                          {openWord === key && (
                            <span className={styles.menu} role="menu">
                              {MISTAKE_TYPES.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={type === t}
                                  className={`${styles.menuItem} ${TYPE_CLASS[t]} ${type === t ? styles.menuSel : ""}`}
                                  onClick={() => setFlag(key, t)}
                                >
                                  {mistakeTypeLabel(t, subject)}
                                </button>
                              ))}
                              {type && (
                                <button type="button" role="menuitem" className={styles.menuRemove} onClick={() => setFlag(key, null)}>
                                  إزالة التحديد
                                </button>
                              )}
                            </span>
                          )}
                        </span>
                      );
                    })}
                    <span className={styles.ayahNum}>﴿{toArabicDigits(ayah)}﴾</span>{" "}
                  </Fragment>
                );
              })}
            </div>
          )}
          <div className={styles.legend}>
            {MISTAKE_TYPES.map((t) => (
              <span key={t} className={`${styles.legendItem} ${TYPE_CLASS[t]}`}>
                {mistakeTypeLabel(t, subject)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
