"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./home-log.module.css";
import { TargetProgress, segmentTitle } from "./TargetProgress";
import { useSurahText } from "./useSurahText";
import { quranFont } from "@/components/mistakes/quran-font";
import { FlaggableAyah, useWordMenu, type WordFlags } from "@/components/mistakes/FlaggableAyah";
import type { MistakeType } from "@/lib/students/mistake-types";
import type { RecitationSubject } from "@/lib/recitation/logic";
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
}: {
  segment: HomeSegmentView;
  groupGender: GroupGender;
  actions: SegmentActions;
  listHref: string;
  // self-marked mistakes: the ayat's words become tappable, and a pick is
  // handed to onFlag (which saves it). Absent = plain text, as before.
  marking?: { flags: WordFlags; onFlag: (key: string, type: MistakeType | null) => void; subject: RecitationSubject };
  // anything to show right after each ayah number (e.g. a note marker)
  afterAyah?: (ayah: number) => ReactNode;
}) {
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const ayahs = useSurahText(s.surahNumber);
  const menu = useWordMenu();

  // counts shown on screen: updated instantly on tap, reverted if refused
  const [counts, setCounts] = useState<Record<Key, HomeCounts>>(() => {
    const init: Record<Key, HomeCounts> = { [SEG]: { ...s.counts } };
    for (const [a, c] of Object.entries(s.ayahCounts)) init[a] = { ...c };
    return init;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"finish" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  const get = (key: Key, kind: HomeTapKind) => counts[key]?.[kind] ?? 0;
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
      <Link href={listHref} className={styles.linkBtn} style={{ display: "inline-block", margin: "0 4px 10px" }}>
        → مقاطعي
      </Link>

      <div className={styles.section}>
        <div className={styles.segTitle}>
          {segmentTitle(s)}
          {s.assignmentId && <span className={`${styles.badge} ${styles.teacher}`}>📌 واجب</span>}
        </div>
        <div className={styles.segMeta}>بدأ {s.createdAt}</div>

        {done && (
          <div className={styles.celebrate} role="status">
            🎉 {p("أحسنتَ! أتممتَ أهداف هذا المقطع", "أحسنتِ! أتممتِ أهداف هذا المقطع")} 🎉
          </div>
        )}

        <div className={styles.counters}>
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
                <button type="button" className={styles.undoBtn} onClick={() => tap(SEG, k, true)} disabled={n === 0}>
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

      <div className={styles.sectionTitle}>الآيات — {p("تدرّب", "تدرّبي")} على كل آية وحدها</div>
      <div className={`${styles.section}`}>
        {Array.from({ length: s.toAyah - s.fromAyah + 1 }, (_, i) => s.fromAyah + i).map((a) => (
          <div key={a} className={styles.ayah}>
            <div className={`${styles.ayahText} ${quranFont.className}`} lang="ar">
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
                />
              ) : ayahs ? (
                ayahs[a - 1]
              ) : (
                "…"
              )}{" "}
              <span className={styles.ayahNum}>﴿{a}﴾</span>
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
                      className={styles.miniMinus}
                      onClick={() => tap(String(a), k, true)}
                      disabled={n === 0}
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
            <button type="button" className={styles.ghostBtn} onClick={() => setConfirm("finish")}>
              ✓ أتممتُ هذا المقطع
            </button>
            {!hasTaps && !s.assignmentId && (
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirm("delete")}>
                حذف المقطع
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
