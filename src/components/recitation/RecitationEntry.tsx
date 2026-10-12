"use client";

import { useMemo, useState } from "react";
import styles from "./recitation.module.css";
import {
  calculatePageRange,
  classifyRecitation,
  deriveCurrentPosition,
  deriveReach,
  nextExpectedEntry,
  withSession,
  type PageRangeError,
  type PageRangeResult,
  type PlanPosition,
  type PositionSession,
  type Reach,
  type RecitationSubject,
  type SessionType,
} from "@/lib/recitation/logic";
import { AYAH_COUNT, SURAHS, SURAH_NAME } from "@/lib/quran-data";
import { rangeIsMemorized } from "@/lib/students/progress";
import { classifyWithDirections, reverseOrder, type DirectionalClassification, type JuzDirections } from "@/lib/recitation/juz-direction";
import { flagKey, type WordFlags } from "@/components/mistakes/FlaggableAyah";
import type { MistakeType } from "@/lib/students/mistake-types";
import { partsLabel, planCombinedEntry, rangeAllMemorized, type EntryContext } from "@/lib/recitation/combined";

// The part of recording a session that the staff student page and «رفيق
// الحفظ» share: what is being recited (type, surah, ayat), its page count,
// the gap check and its reason, and the flagged words. Each page keeps its
// own layout and its own extra fields (quality, date, mode, notes, ...) and
// arranges these pieces around them.

/**
 * A course student on an untouched reverse plan: the juz directions decided
 * so far and her sessions as position logic sees them, so the form judges
 * each juz the way the server will (src/lib/recitation/juz-direction.ts).
 */
export interface DirectionalPlan {
  directions: JuzDirections;
  sessions: PositionSession[];
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = { NEW: "حفظ جديد", REVIEW: "مراجعة", LINK: "ربط" };

export function useRecitationEntry({
  plan,
  position,
  reach,
  memorizedRanges,
  subject,
  directional = null,
  course = null,
}: {
  plan: number[];
  position: PlanPosition | null;
  reach: Reach;
  memorizedRanges: Record<number, [number, number][]>;
  subject: RecitationSubject;
  // only for a reverse plan with juz directions; null = judged on `plan`
  directional?: DirectionalPlan | null;
  // a course student's page only: a «حفظ جديد» entry over memorized ayat is
  // split (lib/recitation/combined.ts), and her earlier unresolved mistakes
  // are shown on the memorized ayat she recites
  course?: { previousMistakes: { surahNumber: number; ayah: number; wordPosition: number; type: MistakeType }[] } | null;
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
  // earlier mistakes marked «تم الإتقان» in this form (removed on save)
  const [mastered, setMastered] = useState<Record<string, true>>({});

  // A juz direction correction, a plan change or added prior memorization
  // moves where she stands without a save from this form: suggest the new
  // next entry. (After a save here the refreshed suggestion is the one
  // afterSave already set.)
  const expectedKey = `${plan.join(",")}|${initialEntry.surahNumber}:${initialEntry.fromAyah}:${initialEntry.toAyah}`;
  const [suggestedFor, setSuggestedFor] = useState(expectedKey);
  if (suggestedFor !== expectedKey) {
    setSuggestedFor(expectedKey);
    setSurahNumber(initialEntry.surahNumber);
    setFromAyah(initialEntry.fromAyah);
    setToAyah(initialEntry.toAyah);
    setReason("");
    setMastered({});
  }

  const judged = useMemo<DirectionalClassification>(
    () =>
      directional
        ? classifyWithDirections(directional.directions, directional.sessions, surahNumber, fromAyah, subject)
        : { classification: classifyRecitation(plan, reach, surahNumber, fromAyah, subject), adopt: null },
    [directional, plan, reach, surahNumber, fromAyah, subject],
  );
  const pageResult = useMemo(() => calculatePageRange(surahNumber, fromAyah, toAyah), [surahNumber, fromAyah, toAyah]);

  // gap detection (and its mandatory reason) applies to new memorization only
  const isNew = sessionType === "NEW";
  const hasRangeError = "error" in pageResult;

  // a course entry over memorized ayat: what will be saved, exactly as the
  // server will split and judge it (null: an ordinary entry)
  const entryCtx = useMemo<EntryContext | null>(
    () => (course ? { plan, reach, directional: directional ? { directions: directional.directions, sessions: directional.sessions } : null } : null),
    [course, plan, reach, directional],
  );
  const combo = useMemo(
    () => (entryCtx && isNew && !hasRangeError ? planCombinedEntry(entryCtx, surahNumber, fromAyah, toAyah, subject) : null),
    [entryCtx, isNew, hasRangeError, surahNumber, fromAyah, toAyah, subject],
  );
  // every ayah already memorized: a re-recording, as before (with a hint)
  const allMemorized = !!entryCtx && isNew && !hasRangeError && rangeAllMemorized(entryCtx, surahNumber, fromAyah, toAyah);

  const classification = combo ? combo.classification : judged.classification;
  const requiresReason = isNew && (combo ? combo.requiresReason : classification.requiresReason);
  const reviewOfUnmemorized = !isNew && !rangeIsMemorized(memorizedRanges[surahNumber], fromAyah, toAyah);
  const reasonFilled = reason.trim().length > 0;

  // her earlier unresolved mistakes on the memorized ayat she recites now:
  // the whole range of a review/link, the «ربط» parts of a combined entry
  const previousFlags = useMemo<WordFlags>(() => {
    if (!course || hasRangeError) return {};
    const shownAyah = (a: number) =>
      isNew ? !!combo?.parts.some((p) => p.type === "LINK" && a >= p.fromAyah && a <= p.toAyah) : a >= fromAyah && a <= toAyah;
    return Object.fromEntries(
      course.previousMistakes
        .filter((m) => m.surahNumber === surahNumber && shownAyah(m.ayah))
        .map((m) => [flagKey(m.surahNumber, m.ayah, m.wordPosition), m.type]),
    );
  }, [course, hasRangeError, isNew, combo, surahNumber, fromAyah, toAyah]);

  function toggleMastered(key: string) {
    setMastered((m) => {
      const next = { ...m };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

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
      // only words whose earlier mistake is shown right now
      mastered: Object.keys(mastered)
        .filter((key) => previousFlags[key])
        .map((key) => {
          const [, ayah, wordPosition] = key.split(":").map(Number);
          return { ayah, wordPosition };
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
    setMastered({});
    if (combo) {
      // from where she stands once every part is saved
      const next = nextExpectedEntry(combo.after.plan, deriveCurrentPosition(combo.after.plan, combo.after.reach));
      setSurahNumber(next.surahNumber);
      setFromAyah(next.fromAyah);
      setToAyah(next.toAyah);
    } else if (isNew && classification.situation !== "EDIT") {
      // from where she stands with this entry included — which may skip
      // past surahs already covered further ahead
      const saved = { surahNumber, fromAyah, toAyah, type: sessionType, situation: classification.situation, reason };
      // in the order this entry may just have decided for its juz
      const adopt = directional && judged.adopt;
      const nextPlan = adopt ? reverseOrder({ ...directional.directions, [adopt.juz]: adopt.direction }) : plan;
      const nextReach = adopt ? deriveReach(nextPlan, directional.sessions) : reach;
      const next = nextExpectedEntry(nextPlan, deriveCurrentPosition(nextPlan, withSession(nextPlan, nextReach, saved)));
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
    combo,
    allMemorized,
    previousFlags,
    mastered,
    toggleMastered,
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

      {entry.combo && (
        <div className={styles.comboNote}>
          ✂️ بعض هذه الآيات محفوظ سابقًا، فسيُسجَّل التسميع هكذا: <strong>{partsLabel(entry.combo.parts)}</strong> — بتقييم واحد،
          وفي السجل تسميعٌ واحد.
        </div>
      )}

      {entry.allMemorized && (
        <div className={styles.comboNote}>
          كل هذه الآيات محفوظة سابقًا، فسيُسجَّل التسميع إعادةَ تسجيل.
          <button type="button" className={styles.comboBtn} onClick={() => entry.setSessionType("LINK")}>
            تسجيله ربطًا
          </button>
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
