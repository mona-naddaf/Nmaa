"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./mistakes.module.css";
import { quranFont } from "./quran-font";
import { displayUnits, splitLetters } from "@/lib/tajweed/letters";
import { confusionsFor, LETTER_NAME, makhrajByCode } from "@/lib/tajweed/letter-facts";
import { orderedGroups, orderedSifat, suggestGapGroups, suggestLetterGroups, suggestMakharij } from "@/lib/tajweed/suggest";
import { detailText, GENERAL, KIND_LABEL, TAJWEED_KINDS, type TajweedKind } from "@/lib/tajweed/taxonomy";
import { addDetail, letterSpot, GAP, removeDetail, sameDetail, spotKey, type DetailError, type DetailFlags } from "@/lib/tajweed/spots";

// The detailed tajweed sheet («أخطاء التجويد المفصّلة», lib/tajweed): one word
// split into its letters (or one gap between two words), the mistakes on the
// chosen letter or gap, and the rules to pick from — the likely ones first,
// every one always reachable. Shared by every word picker that turns detail
// on; the caller keeps the flags (a session form, or saved marks).

export interface SheetTarget {
  surah: number;
  ayah: number;
  wordPosition: number;
  wordText: string;
  /** the word after the gap (maybe the next ayah's first), for the gap's rules */
  nextWordText: string | null;
  /** pause signs after the word, and whether it ends its ayah (gap rules) */
  marks: string;
  ayahEnd: boolean;
  /** "LETTER" with the kind picked from the word's menu, or the gap after the word */
  mode: { target: "LETTER"; kind: TajweedKind } | { target: "GAP" };
  /**
   * The gaps on either side of the word, shown as full-size targets at the
   * ends of its letters (the inline ones are slim): the gap after it (when
   * the next word is recited too), and the one before it (the previous
   * word's gap, opened as that word's).
   */
  gapAfterOk: boolean;
  before: Omit<SheetTarget, "mode" | "before" | "gapAfterOk"> | null;
}

export function TajweedSheet({
  target,
  enabled,
  flags,
  previous,
  mastered,
  onChange,
  onToggleMastered,
  onClose,
  onSwitch,
  currentLabel = "في هذا التسميع",
  onMasterSpot,
}: {
  target: SheetTarget;
  /** new detailed mistakes may be added (off: earlier ones are only shown and mastered) */
  enabled: boolean;
  flags: DetailFlags;
  previous?: DetailFlags;
  mastered?: Record<string, true>;
  onChange: (key: string, errors: DetailError[]) => void;
  onToggleMastered?: (key: string) => void;
  onClose: () => void;
  /** open another spot in the sheet (a gap beside the word) */
  onSwitch: (target: SheetTarget) => void;
  /** the heading over the spot's own mistakes (a session form: this recitation) */
  currentLabel?: string;
  /** saved marks (home practice): «تم الإتقان» for everything on the spot */
  onMasterSpot?: (key: string) => void;
}) {
  const units = useMemo(() => splitLetters(target.wordText), [target.wordText]);
  const shown = useMemo(() => displayUnits(units), [units]);
  const [kind, setKind] = useState<TajweedKind>(target.mode.target === "LETTER" ? target.mode.kind : "HUKM");
  const [letter, setLetter] = useState<number | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [lettersOpen, setLettersOpen] = useState(false);

  const isGap = target.mode.target === "GAP";
  const keyOf = (l: number) => spotKey(target.surah, target.ayah, target.wordPosition, letterSpot(l));
  const gapKey = spotKey(target.surah, target.ayah, target.wordPosition, GAP);
  const key = isGap ? gapKey : letter ? keyOf(letter) : null;
  const errors = key ? (flags[key] ?? []) : [];
  const before = key ? (previous?.[key] ?? []) : [];

  // Escape closes; the sheet keeps focus inside the page (no trap needed: it is not modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(next: DetailError[]) {
    if (key) onChange(key, next);
  }

  /**
   * A letter tapped: chosen, and (when new mistakes may be added) marked with
   * the kind at once — unless it holds earlier mistakes still open: then it
   * was tapped to review them («تم الإتقان»), and a new one is only added
   * from the options below.
   */
  function pickLetter(l: number) {
    setLetter(l);
    setAllOpen(false);
    setLettersOpen(false);
    if (!enabled) return;
    const k = keyOf(l);
    if ((previous?.[k]?.length ?? 0) > 0 && !mastered?.[k]) return;
    const list = flags[k] ?? [];
    if (list.some((e) => e.kind === kind)) return;
    // a makhraj mistake names the makhraj the letter should come from
    const code = kind === "MAKHRAJ" ? (suggestMakharij(target.wordText, l)[0] ?? GENERAL) : GENERAL;
    onChange(k, addDetail(list, { kind, code, confusedWith: null }));
  }

  function toggle(add: DetailError) {
    const has = errors.some((e) => sameDetail(e, add));
    set(has ? removeDetail(errors, add) : addDetail(errors, add));
  }

  /** «نُطق قريبًا من حرف»: on the letter's makhraj mistake (made if there is none). */
  function confuse(l: string) {
    const current = errors.find((e) => e.kind === "MAKHRAJ");
    const code = current?.code ?? suggestMakharij(target.wordText, letter!)[0] ?? GENERAL;
    const same = current?.confusedWith === l;
    set(addDetail(errors, { kind: "MAKHRAJ", code, confusedWith: same ? null : l }));
  }

  const chip = (e: DetailError, label: string, suggested = false) => {
    const sel = errors.some((x) => sameDetail(x, e));
    return (
      <button
        key={`${e.kind}:${e.code}`}
        type="button"
        className={`pressable ${styles.ruleChip} ${sel ? styles.ruleSel : ""} ${suggested ? styles.ruleSuggested : ""}`}
        aria-pressed={sel}
        onClick={() => toggle(e)}
      >
        {label}
      </button>
    );
  };

  const groups = isGap
    ? orderedGroups(
        "GAP",
        suggestGapGroups({ left: target.wordText, leftMarks: target.marks, right: target.nextWordText ?? "", ayahEnd: target.ayahEnd }),
      )
    : letter
      ? orderedGroups("LETTER", suggestLetterGroups(target.wordText, letter))
      : [];
  /** A full-size target for the gap before or after the word (it opens as a gap). */
  function sideGap(w: Omit<SheetTarget, "mode" | "before" | "gapAfterOk">, side: "before" | "after") {
    const k = spotKey(w.surah, w.ayah, w.wordPosition, GAP);
    const has = (flags[k]?.length ?? 0) > 0;
    const prev = (previous?.[k]?.length ?? 0) > 0;
    if (!enabled && !has && !prev) return null;
    return (
      <button
        key={side}
        type="button"
        className={`pressable ${styles.sideGap} ${has ? styles.sideGapFlagged : prev ? (mastered?.[k] ? styles.sideGapMastered : styles.sideGapPrevious) : ""}`}
        onClick={() => onSwitch({ ...w, mode: { target: "GAP" }, gapAfterOk: false, before: null })}
        aria-label={side === "before" ? "الفاصل قبل الكلمة" : "الفاصل بعد الكلمة"}
      >
        <span aria-hidden="true" />
      </button>
    );
  }

  const likely = groups.filter((g) => g.suggested);
  const rest = groups.filter((g) => !g.suggested);
  // nothing likely: every group at once
  const showAll = allOpen || likely.length === 0;
  const unit = letter ? units[letter - 1] : null;

  return (
    <div className={styles.sheet} role="dialog" aria-label={isGap ? "خطأ بين كلمتين" : "حروف الكلمة"}>
      <div className={styles.sheetHead}>
        {isGap ? (
          <span className={styles.sheetTitle}>
            بين{" "}
            <span className={quranFont.className} lang="ar">
              {target.wordText}
            </span>{" "}
            و{" "}
            <span className={quranFont.className} lang="ar">
              {target.nextWordText}
            </span>
          </span>
        ) : (
          <div className={styles.kindTabs} role="tablist">
            {TAJWEED_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                className={`pressable ${styles.kindTab} ${kind === k ? styles.kindTabSel : ""}`}
                onClick={() => {
                  setKind(k);
                  setAllOpen(false);
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        <button type="button" className={`pressable ${styles.sheetClose}`} onClick={onClose} aria-label="إغلاق">
          ✕
        </button>
      </div>

      {!isGap && (
        <div className={`${quranFont.className} ${styles.letters}`} dir="rtl" lang="ar">
          {target.before && sideGap(target.before, "before")}
          {units.map((u, i) => {
            const k = keyOf(u.index);
            const has = (flags[k]?.length ?? 0) > 0;
            const prev = (previous?.[k]?.length ?? 0) > 0;
            return (
              <button
                key={u.index}
                type="button"
                className={`pressable ${styles.letter} ${letter === u.index ? styles.letterSel : ""} ${has ? styles.letterFlagged : ""} ${
                  prev ? (mastered?.[k] ? styles.letterMastered : styles.letterPrevious) : ""
                }`}
                onClick={() => pickLetter(u.index)}
                aria-pressed={letter === u.index}
                aria-label={`الحرف ${u.index}${has ? "، عليه خطأ" : ""}${prev ? "، عليه خطأ سابق" : ""}`}
              >
                {shown[i]}
              </button>
            );
          })}
          {target.gapAfterOk && sideGap(target, "after")}
        </div>
      )}

      <div className={styles.sheetBody}>
        {!isGap && !letter && <div className={styles.sheetHint}>يُحدَّد الحرف بالضغط عليه.</div>}

        {key && before.length > 0 && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>أخطاء سابقة هنا</div>
            {before.map((e) => (
              <div key={`${e.kind}:${e.code}`} className={`${styles.currentRow} ${mastered?.[key] ? styles.currentMastered : ""}`}>
                {detailText(e)}
              </div>
            ))}
            {onToggleMastered && (
              <button
                type="button"
                className={`pressable ${mastered?.[key] ? styles.menuRemove : styles.menuMastered}`}
                onClick={() => onToggleMastered(key)}
              >
                {mastered?.[key] ? "التراجع عن «تم الإتقان»" : "تم الإتقان ✓"}
              </button>
            )}
          </div>
        )}

        {key && errors.length > 0 && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>{currentLabel}</div>
            {errors.map((e) => (
              <div key={`${e.kind}:${e.code}`} className={styles.currentRow}>
                <span>{detailText(e)}</span>
                <button type="button" className={`pressable ${styles.currentRemove}`} onClick={() => set(removeDetail(errors, e))} aria-label="إزالة">
                  ✕
                </button>
              </div>
            ))}
            {onMasterSpot && (
              <button type="button" className={`pressable ${styles.menuMastered}`} onClick={() => onMasterSpot(key)}>
                تم الإتقان ✓
              </button>
            )}
          </div>
        )}

        {enabled && key && (
          <div className={styles.sheetSection}>
            {kind === "MAKHRAJ" && unit && (
              <>
                <div className={styles.sheetLabel}>المخرج</div>
                <div className={styles.ruleChips}>
                  {suggestMakharij(target.wordText, letter!).map((c, i) =>
                    chip({ kind: "MAKHRAJ", code: c, confusedWith: errors.find((e) => e.code === c)?.confusedWith ?? null }, makhrajByCode(c)!.label, i === 0),
                  )}
                </div>
                <div className={styles.sheetLabel}>نُطق قريبًا من حرف</div>
                <div className={`${quranFont.className} ${styles.ruleChips}`}>
                  {(() => {
                    const c = confusionsFor(unit.letter);
                    const current = errors.find((e) => e.kind === "MAKHRAJ")?.confusedWith;
                    const btn = (l: string) => (
                      <button
                        key={l}
                        type="button"
                        className={`pressable ${styles.letterChip} ${current === l ? styles.ruleSel : ""}`}
                        aria-pressed={current === l}
                        aria-label={LETTER_NAME[l]}
                        onClick={() => confuse(l)}
                      >
                        {l}
                      </button>
                    );
                    return (
                      <>
                        {c.suggested.map(btn)}
                        {lettersOpen ? (
                          c.rest.map(btn)
                        ) : (
                          <button type="button" className={`pressable ${styles.moreBtn}`} onClick={() => setLettersOpen(true)}>
                            حروف أخرى
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}

            {kind === "SIFA" && letter && (
              <>
                <div className={styles.sheetLabel}>الصفة</div>
                <div className={styles.ruleChips}>
                  {chip({ kind: "SIFA", code: GENERAL, confusedWith: null }, "صفة (دون تفصيل)")}
                  {orderedSifat(target.wordText, letter)
                    .filter((s) => s.suggested || allOpen)
                    .map((s) => chip({ kind: "SIFA", code: s.code, confusedWith: null }, s.label, s.suggested))}
                  {!allOpen && (
                    <button type="button" className={`pressable ${styles.moreBtn}`} onClick={() => setAllOpen(true)}>
                      كل الصفات
                    </button>
                  )}
                </div>
              </>
            )}

            {(kind === "HUKM" || isGap) && (
              <>
                <div className={styles.ruleChips}>
                  {chip({ kind: "HUKM", code: GENERAL, confusedWith: null }, isGap ? "خطأ في حكم بين الكلمتين (دون تفصيل)" : "حكم تجويد (دون تفصيل)")}
                </div>
                {[...likely, ...(showAll ? rest : [])].map(({ group, suggested }) => (
                  <div key={group.code} className={styles.ruleGroup}>
                    <div className={styles.sheetLabel}>
                      {group.label}
                      {group.hint && (
                        <span className={`${quranFont.className} ${styles.ruleHint}`} lang="ar">
                          {" "}
                          {group.hint}
                        </span>
                      )}
                    </div>
                    <div className={styles.ruleChips}>
                      {group.rules.map((r) => chip({ kind: "HUKM", code: r.code, confusedWith: null }, r.label, suggested))}
                    </div>
                  </div>
                ))}
                {!showAll && rest.length > 0 && (
                  <button type="button" className={`pressable ${styles.moreBtn}`} onClick={() => setAllOpen(true)}>
                    كل الأحكام
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
