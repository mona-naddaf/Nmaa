"use client";

import { useMemo, useState } from "react";
import styles from "./recitation.module.css";
import {
  calculatePageRange,
  classifyRecitation,
  deriveCurrentPosition,
  nextExpectedEntry,
  withSession,
  type PageRangeError,
  type PageRangeResult,
  type PlanPosition,
  type Reach,
  type RecitationSubject,
  type SessionType,
} from "@/lib/recitation/logic";
import { AYAH_COUNT, SURAHS, SURAH_NAME } from "@/lib/quran-data";
import { rangeIsMemorized } from "@/lib/students/progress";
import type { WordFlags } from "@/components/mistakes/WordFlagger";

// The part of recording a session that the staff student page and «رفيق
// الحفظ» share: what is being recited (type, surah, ayat), its page count,
// the gap check and its reason, and the flagged words. Each page keeps its
// own layout and its own extra fields (quality, date, mode, notes, ...) and
// arranges these pieces around them.

export const SESSION_TYPE_LABEL: Record<SessionType, string> = { NEW: "حفظ جديد", REVIEW: "مراجعة", LINK: "ربط" };

export function useRecitationEntry({
  plan,
  position,
  reach,
  memorizedRanges,
  subject,
}: {
  plan: number[];
  position: PlanPosition | null;
  reach: Reach;
  memorizedRanges: Record<number, [number, number][]>;
  subject: RecitationSubject;
}) {
  const initialEntry = nextExpectedEntry(plan, position);
  const [surahNumber, setSurahNumber] = useState(initialEntry.surahNumber);
  const [fromAyah, setFromAyah] = useState(initialEntry.fromAyah);
  const [toAyah, setToAyah] = useState(initialEntry.toAyah);
  const [sessionType, setSessionType] = useState<SessionType>("NEW");
  const [reason, setReason] = useState("");
  // words flagged as mistakes, keyed "surah:ayah:word"; only those inside
  // the current surah and range are submitted
  const [wordFlags, setWordFlags] = useState<WordFlags>({});

  const classification = useMemo(
    () => classifyRecitation(plan, reach, surahNumber, fromAyah, subject),
    [plan, reach, surahNumber, fromAyah, subject],
  );
  const pageResult = useMemo(() => calculatePageRange(surahNumber, fromAyah, toAyah), [surahNumber, fromAyah, toAyah]);

  // gap detection (and its mandatory reason) applies to new memorization only
  const isNew = sessionType === "NEW";
  const requiresReason = isNew && classification.requiresReason;
  const reviewOfUnmemorized = !isNew && !rangeIsMemorized(memorizedRanges[surahNumber], fromAyah, toAyah);
  const reasonFilled = reason.trim().length > 0;
  const hasRangeError = "error" in pageResult;

  /** A new surah picked from the list: its first ayat, at most 15. */
  function chooseSurah(n: number) {
    setSurahNumber(n);
    setFromAyah(1);
    setToAyah(Math.min(15, AYAH_COUNT[n]));
  }

  /** Switch to reviewing a whole surah. */
  function startReview(surah: number) {
    setSessionType("REVIEW");
    setSurahNumber(surah);
    setFromAyah(1);
    setToAyah(AYAH_COUNT[surah]);
  }

  /** What to send to the server for this entry. */
  function entryInput() {
    return {
      surahNumber,
      fromAyah,
      toAyah,
      type: sessionType,
      reason: requiresReason ? reason : "",
      mistakes: Object.entries(wordFlags).flatMap(([key, type]) => {
        const [s, ayah, wordPosition] = key.split(":").map(Number);
        return s === surahNumber && ayah >= fromAyah && ayah <= toAyah ? [{ ayah, wordPosition, type }] : [];
      }),
    };
  }

  /**
   * After a successful save: clear the flags and reason, and advance to the
   * next natural entry — unless this was a review/link or a re-recording of
   * covered material (EDIT), where staying put lets the user keep adjusting.
   */
  function afterSave() {
    setWordFlags({});
    setReason("");
    if (isNew && classification.situation !== "EDIT") {
      // from where she stands with this entry included — which may skip
      // past surahs already covered further ahead
      const saved = { surahNumber, fromAyah, toAyah, type: sessionType, situation: classification.situation, reason };
      const next = nextExpectedEntry(plan, deriveCurrentPosition(plan, withSession(plan, reach, saved)));
      setSurahNumber(next.surahNumber);
      setFromAyah(next.fromAyah);
      setToAyah(next.toAyah);
    }
  }

  return {
    surahNumber,
    fromAyah,
    toAyah,
    sessionType,
    reason,
    wordFlags,
    setFromAyah,
    setToAyah,
    setSessionType,
    setReason,
    setWordFlags,
    chooseSurah,
    startReview,
    entryInput,
    afterSave,
    classification,
    pageResult,
    isNew,
    requiresReason,
    reviewOfUnmemorized,
    reasonFilled,
    hasRangeError,
  };
}

export type RecitationEntryState = ReturnType<typeof useRecitationEntry>;

export function SessionTypePills({ entry }: { entry: RecitationEntryState }) {
  return (
    <div className={styles.typePills} role="radiogroup" aria-label="نوع الجلسة">
      {(["NEW", "REVIEW", "LINK"] as SessionType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={entry.sessionType === t}
          className={`${styles.typePill} ${entry.sessionType === t ? styles.sel : ""}`}
          onClick={() => entry.setSessionType(t)}
        >
          {SESSION_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

/** The surah and ayah fields, as three `.field`s for the caller's own row. */
export function SurahRangeFields({ entry }: { entry: RecitationEntryState }) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="surahSel">السورة</label>
        <select id="surahSel" value={entry.surahNumber} onChange={(e) => entry.chooseSurah(Number(e.target.value))}>
          {SURAHS.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="fromAyah">من آية</label>
        <input
          id="fromAyah"
          type="number"
          min={1}
          value={entry.fromAyah}
          onChange={(e) => entry.setFromAyah(parseInt(e.target.value, 10) || 0)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="toAyah">إلى آية</label>
        <input
          id="toAyah"
          type="number"
          min={1}
          value={entry.toAyah}
          onChange={(e) => entry.setToAyah(parseInt(e.target.value, 10) || 0)}
        />
      </div>
    </>
  );
}

/**
 * The entry's status: the gap-check badge and warning for new memorization,
 * or a note that a review/link doesn't move anyone; plus a warning when a
 * review/link names ayat never recorded as new memorization.
 * positionOf: «موضع الطالبة» / «موضعك»; confirmVerb: «تأكّدي» / «تأكّد».
 */
export function EntryStatus({
  entry,
  positionOf,
  confirmVerb,
}: {
  entry: RecitationEntryState;
  positionOf: string;
  confirmVerb: string;
}) {
  const { classification, isNew, sessionType } = entry;
  return (
    <>
      {isNew ? (
        <div className={`${styles.modeBadge} ${styles[classification.badgeVariant]}`}>{classification.badgeText}</div>
      ) : (
        <div className={`${styles.modeBadge} ${styles.next}`}>
          ↺ {SESSION_TYPE_LABEL[sessionType]} — لا تغيّر {positionOf} ولا تخضع لفحص الفجوات
        </div>
      )}

      {isNew && classification.warningMessage && (
        <div className={styles.gapWarning}>
          ⚠️ <div>{classification.warningMessage}</div>
        </div>
      )}

      {entry.reviewOfUnmemorized && !entry.hasRangeError && (
        <div className={styles.gapWarning}>
          ⚠️ <div>هذه الآيات لم تُسجَّل كحفظ جديد بعد — سيُحفظ التسجيل كـ{SESSION_TYPE_LABEL[sessionType]} دون أن يغيّر الموضع. {confirmVerb} من نوع الجلسة.</div>
        </div>
      )}
    </>
  );
}

/** The mandatory reason, shown only when the gap check requires one. */
export function ReasonBox({ entry, placeholder }: { entry: RecitationEntryState; placeholder: string }) {
  if (!entry.requiresReason) return null;
  return (
    <div className={styles.reasonBox}>
      <label htmlFor="reasonText">سبب هذا التسجيل (إلزامي)</label>
      <textarea id="reasonText" placeholder={placeholder} value={entry.reason} onChange={(e) => entry.setReason(e.target.value)} />
    </div>
  );
}

/** This session's exact page count and page range. */
export function PageCalc({ surahNumber, pageResult }: { surahNumber: number; pageResult: PageRangeResult | PageRangeError }) {
  const hasRangeError = "error" in pageResult;
  return (
    <div className={styles.liveCalc}>
      <div>
        <div className={styles.lcLabel}>صفحات هذه الجلسة (دقيق)</div>
        <div className={styles.lcVal}>{hasRangeError ? "—" : `${pageResult.totalPages} صفحة`}</div>
      </div>
      <div className={styles.lcSub}>
        {!hasRangeError &&
          `صفحة ${pageResult.minPage}${pageResult.maxPage > pageResult.minPage ? ` إلى ${pageResult.maxPage}` : ""} — سورة ${SURAH_NAME[surahNumber]}`}
      </div>
    </div>
  );
}

export { styles as recitationStyles };
