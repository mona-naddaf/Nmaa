"use client";

import { useMemo, useState } from "react";
import styles from "./plan.module.css";
import { AYAH_COUNT, SURAH_BY_NUMBER } from "@/lib/quran-data";
import { calculatePageRange } from "@/lib/recitation/logic";
import { planRange, type PriorPartial } from "@/lib/students/new-student";

// Memorization from before: whole surahs (picked one by one or as a range
// of the plan) and at most one surah memorized in part. Shared by the staff
// «add student» form and «رفيق الحفظ»; the caller keeps the state
// (usePriorState) and sends it with its own save.

export function usePriorState() {
  const [hasPrior, setHasPrior] = useState(false);
  const [completedSurahs, setCompletedSurahs] = useState<number[]>([]);
  const [partialSurah, setPartialSurah] = useState<number | null>(null);
  const [partialFrom, setPartialFrom] = useState(1);
  const [partialTo, setPartialTo] = useState(1);

  /** What to send: nothing unless she said she has prior memorization. */
  function value(): { completedSurahs: number[]; partial: PriorPartial | null } {
    if (!hasPrior) return { completedSurahs: [], partial: null };
    return {
      completedSurahs,
      partial: partialSurah != null ? { surahNumber: partialSurah, fromAyah: partialFrom, toAyah: partialTo } : null,
    };
  }

  function reset() {
    setCompletedSurahs([]);
    setPartialSurah(null);
  }

  return {
    hasPrior,
    setHasPrior,
    completedSurahs,
    setCompletedSurahs,
    partialSurah,
    setPartialSurah,
    partialFrom,
    setPartialFrom,
    partialTo,
    setPartialTo,
    value,
    reset,
  };
}

export type PriorState = ReturnType<typeof usePriorState>;

export type PriorPickerWords = {
  // the two choices: «لا يوجد حفظ سابق» / «نعم، حفظت أجزاءً قبل الانضمام»
  none: string;
  yes: string;
  // «خطة الطالبة» / «خطتك»
  planOf: string;
  // «اختاري» / «اختر» — addressed to whoever is filling it
  choose: string;
  // «تحفظ منها الطالبة» / «تحفظين منها»
  partialWho: string;
};

export function PriorPicker({ plan, prior, words }: { plan: number[]; prior: PriorState; words: PriorPickerWords }) {
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const { hasPrior, setHasPrior, completedSurahs, setCompletedSurahs, partialSurah, setPartialSurah, partialFrom, setPartialFrom, partialTo, setPartialTo } = prior;

  const planSurahs = useMemo(() => plan.map((n) => SURAH_BY_NUMBER[n]), [plan]);

  function addRange() {
    if (rangeFrom == null || rangeTo == null) return;
    const rangeSurahs = planRange(plan, rangeFrom, rangeTo);
    if (!rangeSurahs) return;
    setCompletedSurahs((prev) => [...new Set([...prev, ...rangeSurahs])]);
    if (partialSurah != null && rangeSurahs.includes(partialSurah)) setPartialSurah(null);
  }

  function toggleCompleted(surahNumber: number) {
    setCompletedSurahs((prev) =>
      prev.includes(surahNumber) ? prev.filter((n) => n !== surahNumber) : [...prev, surahNumber],
    );
    if (partialSurah === surahNumber) setPartialSurah(null);
  }

  function removeCompleted(surahNumber: number) {
    setCompletedSurahs((prev) => prev.filter((n) => n !== surahNumber));
  }

  function selectPartialSurah(value: string) {
    if (!value) {
      setPartialSurah(null);
      return;
    }
    const n = Number(value);
    setPartialSurah(n);
    setPartialFrom(1);
    setPartialTo(Math.min(15, AYAH_COUNT[n]));
  }

  const partialSurahOptions = planSurahs.filter((s) => !completedSurahs.includes(s.number));
  const partialPreview = partialSurah != null ? calculatePageRange(partialSurah, partialFrom, partialTo) : null;
  const completedSurahsInPlanOrder = useMemo(
    () => plan.filter((n) => completedSurahs.includes(n)),
    [plan, completedSurahs],
  );

  return (
    <>
      <div className={styles.groupPills}>
        <div className={`${styles.groupPill} ${!hasPrior ? styles.sel : ""}`} onClick={() => setHasPrior(false)}>
          {words.none}
        </div>
        <div className={`${styles.groupPill} ${hasPrior ? styles.sel : ""}`} onClick={() => setHasPrior(true)}>
          {words.yes}
        </div>
      </div>

      {hasPrior && (
        <div style={{ marginTop: 16 }}>
          <div className={styles.subCard}>
            <div className={styles.subTitle}>تحديد نطاق من الخطة كمحفوظ بالكامل</div>
            <div className={styles.rangeRow}>
              <select value={rangeFrom ?? ""} onChange={(e) => setRangeFrom(e.target.value ? Number(e.target.value) : null)}>
                <option value="">من سورة...</option>
                {planSurahs.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={rangeTo ?? ""} onChange={(e) => setRangeTo(e.target.value ? Number(e.target.value) : null)}>
                <option value="">إلى سورة...</option>
                {planSurahs.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addRange} disabled={rangeFrom == null || rangeTo == null}>
                تحديد كمحفوظ بالكامل
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>
              النطاق محسوب حسب ترتيب السور في {words.planOf}، وليس ترتيب المصحف
            </div>
          </div>

          <div className={styles.subCard}>
            <div className={styles.subTitle}>أو {words.choose} سورًا منفردة كمحفوظة بالكامل</div>
            <div className={styles.checkList}>
              {planSurahs.map((s) => (
                <label className={styles.checkRow} key={s.number}>
                  <input type="checkbox" checked={completedSurahs.includes(s.number)} onChange={() => toggleCompleted(s.number)} />
                  {s.name} <span style={{ color: "var(--ink-soft)" }}>({s.ayahs} آية)</span>
                </label>
              ))}
            </div>
          </div>

          {completedSurahsInPlanOrder.length > 0 ? (
            <div className={styles.chipList}>
              {completedSurahsInPlanOrder.map((n) => (
                <span className={styles.chip} key={n}>
                  {SURAH_BY_NUMBER[n].name}
                  <button type="button" onClick={() => removeCompleted(n)} title="إزالة">×</button>
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.emptyChips}>لم تُحدَّد أي سورة كمحفوظة بالكامل بعد</div>
          )}

          <div className={styles.subCard} style={{ marginTop: 16 }}>
            <div className={styles.subTitle}>سورة {words.partialWho} جزءًا حاليًا (اختياري، سورة واحدة فقط)</div>
            <div className={styles.fieldRow} style={{ marginBottom: 0 }}>
              <div className={styles.field}>
                <select value={partialSurah ?? ""} onChange={(e) => selectPartialSurah(e.target.value)}>
                  <option value="">لا يوجد</option>
                  {partialSurahOptions.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {partialSurah != null && (
                <>
                  <div className={styles.field}>
                    <label>من آية</label>
                    <input type="number" min={1} value={partialFrom} onChange={(e) => setPartialFrom(parseInt(e.target.value, 10) || 1)} />
                  </div>
                  <div className={styles.field}>
                    <label>إلى آية</label>
                    <input type="number" min={1} value={partialTo} onChange={(e) => setPartialTo(parseInt(e.target.value, 10) || 1)} />
                  </div>
                </>
              )}
            </div>
            {partialSurah != null && (
              <div style={{ marginTop: 10, fontSize: 12.5 }}>
                {partialPreview && "error" in partialPreview ? (
                  <span style={{ color: "var(--rose-deep)" }}>{partialPreview.error}</span>
                ) : (
                  partialPreview && (
                    <span style={{ color: "var(--sage-deep)", fontWeight: 700 }}>
                      {partialPreview.totalPages} صفحة (صفحة {partialPreview.minPage}
                      {partialPreview.maxPage > partialPreview.minPage ? ` إلى ${partialPreview.maxPage}` : ""})
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
