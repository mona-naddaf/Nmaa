"use client";

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "./similar.module.css";
import { useGuideTarget } from "@/components/guide/targets";
import { quranFont } from "@/components/mistakes/quran-font";
import { toArabicDigits } from "@/components/mistakes/FlaggableAyah";
import { splitAyah } from "@/lib/quran-data/words";
import { SURAH_NAME } from "@/lib/quran-data";
import type { SimilarGroup } from "@/lib/mutashabihat/lookup";
import type { Range } from "@/lib/mutashabihat/build";

// «المتشابهات»: a small copper «≈» after a verse's number when the verse has
// similar verses elsewhere; tapping it opens «آيات متشابهة». The page wraps
// the verses in <SimilarProvider> with its own area's server actions — only
// when the setting is on for this viewer (the actions check again) — and the
// shared verse renderers put <SimilarAfter> after each number. Without a
// provider nothing renders and nothing is fetched.

type Result<T> = T | { error: string };

export interface SimilarSource {
  /** a surah's marked verses (ayah → groups), no text */
  loadSurah: (surah: number) => Promise<Result<Record<number, SimilarGroup[]>>>;
  /** verse texts by key, at most MAX_KEYS per call */
  loadVerses: (keys: string[]) => Promise<Result<Record<string, string>>>;
  /** «رفيق الحفظ»: each similar verse links to its verse page */
  links?: boolean;
}

const MAX_KEYS = 20;
const FIRST_SHOWN = 5;

interface Ctx extends SimilarSource {
  surah: (n: number) => Promise<Record<number, SimilarGroup[]> | null>;
  verses: (keys: string[]) => Promise<Record<string, string> | null>;
}

const SimilarContext = createContext<Ctx | null>(null);

export function SimilarProvider({ loadSurah, loadVerses, links = false, children }: SimilarSource & { children: ReactNode }) {
  // per page: each surah's groups and each verse's text are asked for once
  const surahs = useRef(new Map<number, Promise<Record<number, SimilarGroup[]> | null>>());
  const texts = useRef(new Map<string, string>());

  const surah = useCallback(
    (n: number) => {
      let p = surahs.current.get(n);
      if (!p) {
        p = loadSurah(n)
          .then((r) => ("error" in r && typeof r.error === "string" ? null : (r as Record<number, SimilarGroup[]>)))
          .catch(() => null);
        surahs.current.set(n, p);
      }
      return p;
    },
    [loadSurah],
  );

  const verses = useCallback(
    async (keys: string[]) => {
      const missing = keys.filter((k) => !texts.current.has(k));
      for (let i = 0; i < missing.length; i += MAX_KEYS) {
        const r = await loadVerses(missing.slice(i, i + MAX_KEYS)).catch(() => null);
        if (!r || ("error" in r && typeof r.error === "string")) return null;
        for (const [k, t] of Object.entries(r as Record<string, string>)) texts.current.set(k, t);
      }
      return Object.fromEntries(keys.map((k) => [k, texts.current.get(k) ?? ""]));
    },
    [loadVerses],
  );

  return <SimilarContext.Provider value={{ loadSurah, loadVerses, links, surah, verses }}>{children}</SimilarContext.Provider>;
}

/** After a verse's number: the mark when the verse has similar verses (needs a SimilarProvider). */
export function SimilarAfter({ surah, ayah }: { surah: number; ayah: number }) {
  const ctx = useContext(SimilarContext);
  const [groups, setGroups] = useState<Record<number, SimilarGroup[]> | null>(null);
  useEffect(() => {
    if (!ctx) return;
    let alive = true;
    ctx.surah(surah).then((g) => alive && setGroups(g));
    return () => {
      alive = false;
    };
  }, [ctx, surah]);
  const mine = groups?.[ayah];
  if (!ctx || !mine?.length) return null;
  return <SimilarMark surah={surah} ayah={ayah} groups={mine} ctx={ctx} />;
}

interface Place {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  origin: string;
}

/**
 * Where the popup opens: below the mark (or above when there's more room
 * there), within the screen, growing from the mark's point.
 */
function placeFor(mark: HTMLElement): Place {
  const r = mark.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const width = Math.min(440, vw - 24);
  const left = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), vw - width - 12);
  const below = vh - r.bottom - 16;
  const above = r.top - 16;
  const down = below >= 280 || below >= above;
  const maxHeight = Math.max(200, Math.min(560, (down ? below : above) - 8));
  const top = down ? r.bottom + 6 + window.scrollY : r.top - 6 - maxHeight + window.scrollY;
  return { top, left: left + window.scrollX, width, maxHeight, origin: `${r.left + r.width / 2 - left}px ${down ? "0" : "100%"}` };
}

function SimilarMark({ surah, ayah, groups, ctx }: { surah: number; ayah: number; groups: SimilarGroup[]; ctx: Ctx }) {
  const button = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const t = useGuideTarget();
  const count = new Set(groups.flatMap((g) => g.others.map((o) => o.key))).size;
  return (
    <>
      {" "}
      <button
        ref={button}
        type="button"
        className={`${styles.mark} pressable`}
        aria-label={`آيات متشابهة بالآية ${ayah} (${count})`}
        aria-haspopup="dialog"
        aria-expanded={place !== null}
        {...t("verse.similar")}
        onClick={(e) => {
          // the word picker's menus close on an outside press; this isn't a word
          e.stopPropagation();
          setPlace(place ? null : placeFor(e.currentTarget));
        }}
      >
        <span className={styles.glyph} aria-hidden>
          ≈
        </span>
      </button>
      {place && <SimilarPopup surah={surah} ayah={ayah} groups={groups} ctx={ctx} place={place} anchor={button} onClose={() => setPlace(null)} />}
    </>
  );
}

const CLOSE_MS = 120;

function SimilarPopup({
  surah,
  ayah,
  groups,
  ctx,
  place,
  anchor,
  onClose,
}: {
  surah: number;
  ayah: number;
  groups: SimilarGroup[];
  ctx: Ctx;
  place: Place;
  anchor: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [shown, setShown] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [texts, setTexts] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${surah}:${ayah}`;

  function close(refocus: boolean) {
    setShown(false);
    window.setTimeout(() => {
      onClose();
      if (refocus) anchor.current?.focus();
    }, CLOSE_MS);
  }

  // Escape or a press outside closes it
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") close(true);
  });
  const onDown = useEffectEvent((e: PointerEvent) => {
    const t = e.target as Node;
    if (!box.current?.contains(t) && !anchor.current?.contains(t)) close(false);
  });

  // mounted first, then shown, so the entrance transitions; focus moves into it
  useEffect(() => {
    box.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    const key = (e: KeyboardEvent) => onKey(e);
    const down = (e: PointerEvent) => onDown(e);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
    };
  }, []);

  // the texts on show: this verse and the first verses of each group (all, once expanded)
  const wanted = [key, ...groups.flatMap((g) => (expanded[g.phraseId] ? g.others : g.others.slice(0, FIRST_SHOWN)).map((o) => o.key))];
  const wantedKey = [...new Set(wanted)].join(",");
  useEffect(() => {
    let alive = true;
    ctx.verses(wantedKey.split(",")).then((t) => {
      if (!alive) return;
      if (t) setTexts(t);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [ctx, wantedKey]);

  const textOf = (k: string) => texts?.[k] ?? null;
  const own = textOf(key);

  return createPortal(
    <div
      ref={box}
      className={`${styles.popup} ${shown ? styles.shown : ""}`}
      style={{ top: place.top, left: place.left, width: place.width, maxHeight: place.maxHeight, transformOrigin: place.origin }}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      dir="rtl"
    >
      <div className={styles.head}>
        <span id={titleId} className={styles.title}>
          آيات متشابهة
        </span>
        <button type="button" className={`${styles.close} pressable`} aria-label="إغلاق" onClick={() => close(true)}>
          ×
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.current}>
          <div className={styles.ref}>
            سورة {SURAH_NAME[surah]} · الآية {ayah}
          </div>
          {own ? <Verse surah={surah} ayah={ayah} text={own} ranges={groups.flatMap((g) => g.own)} /> : <div className={styles.wait}>…</div>}
        </div>

        {groups.map((g) => {
          const all = expanded[g.phraseId];
          const list = all ? g.others : g.others.slice(0, FIRST_SHOWN);
          return (
            <section key={g.phraseId} className={styles.group}>
              {groups.length > 1 && own && <div className={`${styles.phrase} ${quranFont.className}`}>{phraseWords(surah, ayah, own, g.own[0])}</div>}
              {list.map((o) => {
                const [s, a] = o.key.split(":").map(Number);
                const text = textOf(o.key);
                const label = `سورة ${SURAH_NAME[s]} · الآية ${a}`;
                return (
                  <div key={o.key} className={styles.other}>
                    {ctx.links ? (
                      <Link href={`/rafiq/verse/${s}/${a}`} className={styles.refLink} onClick={() => close(false)}>
                        {label} ←
                      </Link>
                    ) : (
                      <div className={styles.ref}>{label}</div>
                    )}
                    {text ? <Verse surah={s} ayah={a} text={text} ranges={o.ranges} /> : <div className={styles.wait}>…</div>}
                  </div>
                );
              })}
              {!all && g.others.length > FIRST_SHOWN && (
                <button type="button" className={`${styles.more} pressable`} onClick={() => setExpanded((e) => ({ ...e, [g.phraseId]: true }))}>
                  عرض الكل ({g.others.length})
                </button>
              )}
            </section>
          );
        })}
        {failed && <div className={styles.err}>تعذّر تحميل الآيات، يُرجى المحاولة لاحقًا.</div>}
      </div>

      <div className={styles.credit}>
        بيانات المتشابهات من{" "}
        <a href="https://qul.tarteel.ai/resources/mutashabihat" target="_blank" rel="noopener noreferrer">
          QUL (ترتيل)
        </a>
      </div>
    </div>,
    document.body,
  );
}

const inRanges = (p: number, ranges: Range[]) => ranges.some(([f, t]) => p >= f && p <= t);

/** A verse with the given ranges highlighted, each run of words as one highlight (the basmala prefix left out). */
function Verse({ surah, ayah, text, ranges }: { surah: number; ayah: number; text: string; ranges: Range[] }) {
  const split = splitAyah(surah, ayah, text);
  // consecutive words, highlighted or not, joined into runs
  const runs: { hl: boolean; text: string }[] = [];
  for (const w of split.words) {
    const hl = inRanges(w.position, ranges);
    const piece = w.marks ? `${w.text} ${w.marks}` : w.text;
    const last = runs[runs.length - 1];
    if (last && last.hl === hl) last.text += ` ${piece}`;
    else runs.push({ hl, text: piece });
  }
  return (
    <div className={`${styles.verse} ${quranFont.className}`} lang="ar">
      {split.leadingMarks && `${split.leadingMarks} `}
      {runs.map((r, i) => (
        <span key={i}>
          {r.hl ? <mark className={styles.hl}>{r.text}</mark> : r.text}{" "}
        </span>
      ))}
      <span className={styles.num}>﴿{toArabicDigits(ayah)}﴾</span>
    </div>
  );
}

/** A group's header: the phrase as it reads in this verse. */
function phraseWords(surah: number, ayah: number, text: string, [from, to]: Range): string {
  return splitAyah(surah, ayah, text)
    .words.slice(from - 1, to)
    .map((w) => w.text)
    .join(" ");
}
