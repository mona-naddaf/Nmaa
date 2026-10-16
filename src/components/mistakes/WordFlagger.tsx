"use client";

import { SimilarAfter } from "@/components/quran/Similar";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import styles from "./mistakes.module.css";
import { quranFont } from "./quran-font";
import { MISTAKE_TYPES, mistakeTypeLabel, type MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";
import { FlaggableAyah, TYPE_CLASS, useWordMenu, type WordFlags } from "./FlaggableAyah";
import { TajweedSheet, type SheetTarget } from "./TajweedSheet";
import { splitAyah } from "@/lib/quran-data/words";
import type { DetailError, DetailFlags } from "@/lib/tajweed/spots";

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

// «خطأ تجويد مفصّل واحد»، «خطآن»، «3 أخطاء»، «11 خطأً»
function detailCountText(n: number): string {
  if (n === 1) return "خطأ تجويد مفصّل واحد";
  if (n === 2) return "خطآن مفصّلان";
  return `${n} ${n <= 10 ? "أخطاء تجويد مفصّلة" : "خطأً مفصّلًا"}`;
}

// «3 كلمات من أخطاء سابقة»
function previousWordsText(n: number): string {
  if (n === 1) return "كلمة واحدة من أخطاء سابقة";
  if (n === 2) return "كلمتان من أخطاء سابقة";
  return `${n} ${n <= 10 ? "كلمات" : "كلمة"} من أخطاء سابقة`;
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
  previous,
  mastered,
  onToggleMastered,
  detail,
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
  // the course form only: her earlier unresolved mistakes in this range,
  // shown from the start (the picker opens by itself when there are any)
  // and offered «تم الإتقان»
  previous?: WordFlags;
  mastered?: Record<string, true>;
  onToggleMastered?: (key: string) => void;
  // detailed tajweed (lib/tajweed), the course form only: enabled = she is
  // held to it (new ones may be added); her earlier detailed mistakes show
  // either way, on their letter or gap
  detail?: {
    enabled: boolean;
    flags: DetailFlags;
    onChange: (flags: DetailFlags) => void;
    previous?: DetailFlags;
  };
}) {
  const [ayahs, setAyahs] = useState<{ surah: number; text: string[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null); // null = automatic
  const menu = useWordMenu();
  // the letter / gap sheet, one at a time
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  const inRange = (k: string) => {
    const [s, a] = k.split(":").map(Number);
    return s === surahNumber && a >= fromAyah && a <= toAyah;
  };
  // words with an earlier mistake: on the word itself or on its letters / the gap after it
  const previousWords = new Set(
    [...Object.keys(previous ?? {}), ...Object.keys(detail?.previous ?? {})].filter(inRange).map((k) => k.split(":").slice(0, 3).join(":")),
  );
  const previousHere = previousWords.size;
  const open = expanded ?? (!startCollapsed || previousHere > 0);
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

  const flaggedHere = Object.keys(flags).filter(inRange).length;
  const detailHere = Object.entries(detail?.flags ?? {})
    .filter(([k]) => inRange(k))
    .reduce((n, [, list]) => n + list.length, 0);
  const showDetail = !!detail && (detail.enabled || Object.keys(detail.previous ?? {}).some(inRange));

  /** An ayah's last word, for the gap after it. */
  function lastWordOf(a: number) {
    const words = splitAyah(surahNumber, a, loaded?.[a - 1] ?? "").words;
    const w = words[words.length - 1];
    return w ? { position: w.position, text: w.text, marks: w.marks } : null;
  }

  function setDetail(key: string, errors: DetailError[]) {
    if (!detail) return;
    const next = { ...detail.flags };
    if (errors.length > 0) next[key] = errors;
    else delete next[key];
    detail.onChange(next);
  }

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
          {previousHere > 0 && <span className={styles.flaggerPrevious}>{previousWordsText(previousHere)}</span>}
          {flaggedHere > 0 ? flaggedWordsText(flaggedHere) : ""}
          {flaggedHere > 0 && detailHere > 0 ? " · " : ""}
          {detailHere > 0 ? detailCountText(detailHere) : ""}
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
            <div className={`${quranFont.className} ${styles.quranText} ${showDetail ? styles.detailMode : ""}`} dir="rtl" lang="ar">
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
                    after={
                      <>
                        <SimilarAfter surah={surahNumber} ayah={ayah} />
                        {afterAyah?.(ayah)}
                      </>
                    }
                    previous={previous}
                    mastered={mastered}
                    onToggleMastered={onToggleMastered}
                    detail={
                      showDetail
                        ? {
                            enabled: detail!.enabled,
                            flags: detail!.flags,
                            previous: detail!.previous,
                            mastered,
                            lastGap: ayah < toAyah,
                            nextAyahWord: ayah < toAyah ? (splitAyah(surahNumber, ayah + 1, loaded[ayah] ?? "").words[0]?.text ?? null) : null,
                            prevAyahLast: ayah > fromAyah ? lastWordOf(ayah - 1) : null,
                            open: setSheet,
                          }
                        : undefined
                    }
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
            {showDetail && <span className={`${styles.legendItem} ${styles.tDetail}`}>تجويد مفصّل (على حرف أو بين كلمتين)</span>}
          </div>
        </>
      )}
      {sheet && detail && sheet.surah === surahNumber && (
        <TajweedSheet
          key={`${sheet.ayah}:${sheet.wordPosition}:${sheet.mode.target}`}
          target={sheet}
          enabled={detail.enabled}
          flags={detail.flags}
          previous={detail.previous}
          mastered={mastered}
          onChange={setDetail}
          onToggleMastered={onToggleMastered}
          onClose={() => setSheet(null)}
          onSwitch={setSheet}
        />
      )}
    </div>
  );
}
