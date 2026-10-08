"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import styles from "./mistakes.module.css";
import { quranFont } from "./quran-font";
import { MISTAKE_TYPES, mistakeTypeLabel, type MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";
import { FlaggableAyah, TYPE_CLASS, useWordMenu, type WordFlags } from "./FlaggableAyah";

export { flagKey, TYPE_CLASS, type WordFlags } from "./FlaggableAyah";

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
  afterAyah,
}: {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  startCollapsed: boolean;
  flags: WordFlags;
  onChange: (flags: WordFlags) => void;
  // whose mistakes: a course group's student, or the learner herself
  subject: RecitationSubject;
  // anything to show right after each ayah number (e.g. a note marker)
  afterAyah?: (ayah: number) => ReactNode;
}) {
  const [ayahs, setAyahs] = useState<{ surah: number; text: string[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null); // null = automatic
  const menu = useWordMenu();

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

  const flaggedHere = Object.keys(flags).filter((k) => {
    const [s, a] = k.split(":").map(Number);
    return s === surahNumber && a >= fromAyah && a <= toAyah;
  }).length;

  function setFlag(key: string, type: MistakeType | null) {
    const next = { ...flags };
    if (type) next[key] = type;
    else delete next[key];
    onChange(next);
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
              {Array.from({ length: toAyah - fromAyah + 1 }, (_, i) => fromAyah + i).map((ayah) => (
                <Fragment key={ayah}>
                  <FlaggableAyah
                    surahNumber={surahNumber}
                    ayah={ayah}
                    text={loaded[ayah - 1] ?? ""}
                    flags={flags}
                    menu={menu}
                    onFlag={setFlag}
                    subject={subject}
                    after={afterAyah?.(ayah)}
                  />
                </Fragment>
              ))}
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
