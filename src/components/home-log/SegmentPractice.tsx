"use client";

import { useState, useTransition, type ReactNode } from "react";
import { SimilarAfter } from "@/components/quran/Similar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./home-log.module.css";
import { TargetProgress, segmentTitle } from "./TargetProgress";
import { useSurahText } from "./useSurahText";
import { quranFont } from "@/components/mistakes/quran-font";
import { FlaggableAyah, useWordMenu, type WordFlags } from "@/components/mistakes/FlaggableAyah";
import mistakeStyles from "@/components/mistakes/mistakes.module.css";
import { TajweedSheet, type SheetTarget } from "@/components/mistakes/TajweedSheet";
import { splitAyah } from "@/lib/quran-data/words";
import type { DetailError, DetailFlags } from "@/lib/tajweed/spots";
import type { MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";
import { ShownDay } from "@/components/shown-day/ShownDay";
import {
  allTargetsMet,
  EMPTY_COUNTS,
  HOME_TAP_ICON,
  HOME_TAP_KINDS,
  HOME_TAP_LABEL,
  localToday,
  targetFor,
  type HomeCounts,
  type HomeTapKind,
} from "@/lib/home-log/rules";
import type { HomeSegmentView } from "@/lib/home-log/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { inertClass, inertProps } from "@/components/nudge/nudge";
import { useGuideTarget } from "@/components/guide/targets";

type Key = string; // "seg" or the ayah number
const SEG: Key = "seg";

type TapInput = { segmentId: string; ayah: number | null; kind: HomeTapKind; day: string };
type Result = Promise<{ error?: string }>;

/** What the practice screen can do: a course student's actions, or «رفيق الحفظ»'s own. */
export type SegmentActions = {
  tap: (input: TapInput) => Result;
  undoTap: (input: TapInput) => Result;
  finish: (segmentId: string) => Result;
  remove: (segmentId: string) => Result;
};

// One active segment: big whole-segment counters with their targets, then
// every ayah with its own counters. listHref: the segment list to go back to.
export function SegmentPractice({
  segment: s,
  groupGender: g,
  actions,
  listHref,
  marking,
  afterAyah,
  liveUndo = false,
  beforeAyat,
}: {
  segment: HomeSegmentView;
  groupGender: GroupGender;
  actions: SegmentActions;
  listHref: string;
  // self-marked mistakes: the ayat's words become tappable, and a pick is
  // handed to onFlag (which saves it). Absent = plain text, as before.
  marking?: {
    flags: WordFlags;
    onFlag: (key: string, type: MistakeType | null) => void;
    subject: RecitationSubject;
    hint?: string;
    // detailed tajweed marks (lib/tajweed): on a letter or between words,
    // each change saved by the caller; absent = word marks only, as before
    detail?: {
      flags: DetailFlags;
      onChange: (key: string, errors: DetailError[]) => void;
      // «تم الإتقان» on a spot (absent: not offered — «العائلة», a child)
      onMasterSpot?: (key: string) => void;
    };
  };
  // anything to show right after each ayah number (e.g. a note marker)
  afterAyah?: (ayah: number) => ReactNode;
  // Rafiq and «العائلة»: undo at zero stays visible but inactive, with a
  // tooltip, instead of disabled (unset: disabled, as before)
  liveUndo?: boolean;
  // Rafiq's guidance: a line just above «الآيات» (unset: nothing)
  beforeAyat?: ReactNode;
}) {
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const ayahs = useSurahText(s.surahNumber);
  const menu = useWordMenu();
  // the letter / gap sheet (detailed tajweed marks), one at a time
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const detail = marking?.detail;
  /** An ayah's last word, for the gap after it. */
  const lastWordOf = (a: number) => {
    const words = ayahs ? splitAyah(s.surahNumber, a, ayahs[a - 1] ?? "").words : [];
    const w = words[words.length - 1];
    return w ? { position: w.position, text: w.text, marks: w.marks } : null;
  };

  // counts shown on screen: updated instantly on tap, reverted if refused
  const [counts, setCounts] = useState<Record<Key, HomeCounts>>(() => {
    const init: Record<Key, HomeCounts> = { [SEG]: { ...s.counts } };
    for (const [a, c] of Object.entries(s.ayahCounts)) init[a] = { ...c };
    return init;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"finish" | "delete" | null>(null);
  const t = useGuideTarget();
  const [pending, startTransition] = useTransition();

  const get = (key: Key, kind: HomeTapKind) => counts[key]?.[kind] ?? 0;
  /** Undo with nothing to undo: disabled, or (liveUndo) inactive with a tooltip. */
  const undoAt = (n: number) => (liveUndo ? inertProps(n === 0, "لا يوجد ما يُتراجَع عنه") : { disabled: n === 0 });
  const undoClass = (base: string, n: number) => (liveUndo && n === 0 ? `${base} ${inertClass}` : base);
  const bump = (key: Key, kind: HomeTapKind, by: number) =>
    setCounts((prev) => {
      const c = { ...(prev[key] ?? EMPTY_COUNTS) };
      c[kind] = Math.max(0, c[kind] + by);
      return { ...prev, [key]: c };
    });

  async function tap(key: Key, kind: HomeTapKind, undo = false) {
    if (undo && get(key, kind) === 0) return;
    setMessage(null);
    bump(key, kind, undo ? -1 : 1);
    const input = { segmentId: s.id, ayah: key === SEG ? null : Number(key), kind, day: localToday() };
    const r = undo ? await actions.undoTap(input) : await actions.tap(input);
    if (r.error) {
      bump(key, kind, undo ? 1 : -1);
      setMessage(r.error);
    }
  }

  const segCounts = counts[SEG] ?? EMPTY_COUNTS;
  const done = allTargetsMet(segCounts, s.targets);
  const hasTaps = Object.values(counts).some((c) => c.LISTEN + c.REPEAT + c.RECITE > 0);

  function finish() {
    startTransition(async () => {
      const r = confirm === "delete" ? await actions.remove(s.id) : await actions.finish(s.id);
      if (r.error) return setMessage(r.error);
      router.push(listHref);
    });
  }

  return (
    <div>
      <Link href={listHref} className={styles.linkBtn} style={{ display: "inline-block", margin: "0 4px 10px" }} {...t("practice.back")}>
        → مقاطعي
      </Link>

      <div className={styles.section}>
        <div className={styles.segTitle}>
          {segmentTitle(s)}
          {s.assignmentId && <span className={`${styles.badge} ${styles.teacher}`}>📌 واجب</span>}
        </div>
        <div className={styles.segMeta}>
          بدأ <ShownDay value={s.createdAt} />
        </div>

        {done && (
          <div className={styles.celebrate} role="status">
            🎉 {p("أحسنتَ! أتممتَ أهداف هذا المقطع", "أحسنتِ! أتممتِ أهداف هذا المقطع")} 🎉
          </div>
        )}

        <div className={styles.counters} {...t("practice.counters")}>
          {HOME_TAP_KINDS.map((k) => {
            const n = get(SEG, k);
            const target = targetFor(s.targets, k);
            return (
              <div key={k} className={`${styles.counter} ${n >= target ? styles.met : ""}`}>
                <div className={styles.counterLabel}>
                  {HOME_TAP_ICON[k]} {HOME_TAP_LABEL[k]}
                </div>
                <div className={styles.counterNum} aria-live="polite">
                  {n}
                </div>
                <div className={styles.counterTarget}>
                  الهدف {target} {n >= target ? "✓" : ""}
                </div>
                <button
                  type="button"
                  className={styles.plusBtn}
                  onClick={() => tap(SEG, k)}
                  aria-label={`${HOME_TAP_LABEL[k]} للمقطع كاملًا: إضافة واحد`}
                >
                  +
                </button>
                <button type="button" className={undoClass(styles.undoBtn, n)} onClick={() => tap(SEG, k, true)} {...undoAt(n)}>
                  ↶ تراجع
                </button>
              </div>
            );
          })}
        </div>
        <TargetProgress counts={segCounts} targets={s.targets} />
        {message && (
          <div className={styles.err} role="alert" style={{ marginTop: 8 }}>
            {message}
          </div>
        )}
      </div>

      {beforeAyat}
      <div className={styles.sectionTitle} {...t("practice.ayat")}>
        الآيات — {p("تدرّب", "تدرّبي")} على كل آية وحدها
      </div>
      {marking?.hint && (
        <p className={styles.muted} style={{ margin: "0 4px 10px" }}>
          {marking.hint}
        </p>
      )}
      <div className={`${styles.section}`} {...t("practice.text")}>
        {Array.from({ length: s.toAyah - s.fromAyah + 1 }, (_, i) => s.fromAyah + i).map((a) => (
          <div key={a} className={styles.ayah}>
            <div className={`${styles.ayahText} ${quranFont.className} ${detail ? mistakeStyles.detailMode : ""}`} lang="ar">
              {marking && ayahs ? (
                <FlaggableAyah
                  surahNumber={s.surahNumber}
                  ayah={a}
                  text={ayahs[a - 1]}
                  flags={marking.flags}
                  menu={menu}
                  onFlag={marking.onFlag}
                  subject={marking.subject}
                  showNumber={false}
                  detail={
                    detail && {
                      enabled: true,
                      flags: detail.flags,
                      lastGap: a < s.toAyah,
                      nextAyahWord: a < s.toAyah ? (splitAyah(s.surahNumber, a + 1, ayahs[a] ?? "").words[0]?.text ?? null) : null,
                      prevAyahLast: a > s.fromAyah ? lastWordOf(a - 1) : null,
                      open: setSheet,
                    }
                  }
                />
              ) : ayahs ? (
                ayahs[a - 1]
              ) : (
                "…"
              )}{" "}
              <span className={styles.ayahNum}>﴿{a}﴾</span>
              <SimilarAfter surah={s.surahNumber} ayah={a} />
              {afterAyah?.(a)}
            </div>
            <div className={styles.ayahCounters}>
              {HOME_TAP_KINDS.map((k) => {
                const n = get(String(a), k);
                return (
                  <span key={k} className={styles.miniCounter}>
                    <button
                      type="button"
                      className={styles.miniPlus}
                      onClick={() => tap(String(a), k)}
                      aria-label={`${HOME_TAP_LABEL[k]} للآية ${a}: إضافة واحد (العدد ${n})`}
                    >
                      {HOME_TAP_ICON[k]} {n} +
                    </button>
                    <button
                      type="button"
                      className={undoClass(styles.miniMinus, n)}
                      onClick={() => tap(String(a), k, true)}
                      {...undoAt(n)}
                      aria-label={`تراجع عن ${HOME_TAP_LABEL[k]} للآية ${a}`}
                    >
                      −
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {sheet && detail && (
        <TajweedSheet
          key={`${sheet.ayah}:${sheet.wordPosition}:${sheet.mode.target}`}
          target={sheet}
          enabled
          flags={detail.flags}
          onChange={detail.onChange}
          onClose={() => setSheet(null)}
          onSwitch={setSheet}
          currentLabel="علاماتي هنا"
          onMasterSpot={detail.onMasterSpot ? (key) => detail.onMasterSpot?.(key) : undefined}
        />
      )}

      <div className={styles.section}>
        {confirm ? (
          <div className={styles.actionsRow} style={{ marginTop: 0 }}>
            <span className={styles.muted}>
              {confirm === "delete" ? "حذف هذا المقطع؟" : `${p("أتممتَ", "أتممتِ")} هذا المقطع؟ سينتقل إلى المقاطع السابقة.`}
            </span>
            <button type="button" className={styles.primaryBtn} onClick={finish} disabled={pending}>
              نعم
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setConfirm(null)} disabled={pending}>
              تراجع
            </button>
          </div>
        ) : (
          <div className={styles.actionsRow} style={{ marginTop: 0 }}>
            <button type="button" className={styles.ghostBtn} onClick={() => setConfirm("finish")} {...t("practice.finish")}>
              ✓ أتممتُ هذا المقطع
            </button>
            {!hasTaps && !s.assignmentId && (
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirm("delete")} {...t("practice.delete")}>
                حذف المقطع
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
