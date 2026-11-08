"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./mushaf.module.css";
import { quranFont } from "@/components/mistakes/quran-font";
import { toArabicDigits } from "@/components/mistakes/FlaggableAyah";
import { getAyahPageEntries, SURAH_NAME } from "@/lib/quran-data";
import { loadMushafPage, pageHeader, pagesOf, parseKey, type MushafEntry, type MushafPage } from "@/lib/mushaf/page";
import { loadPageFont } from "@/lib/mushaf/font";
import type { MushafConfig } from "@/lib/mushaf/enabled";

// «صفحة المصحف»: the whole Mushaf page(s) an ayah range of one surah touches,
// line by line exactly as printed (KFGQPC V2, 1421H), drawn with each page's
// own QCF V2 font and scaled to the width, so the lines are the same on a
// phone and a laptop. The range's words are the caller's (word / end);
// everything else on the page is faded context, never tappable and hidden
// from screen readers (they get the range's real text through the caller's
// labels). A page whose data or font can't be loaded shows its ayat in the
// old view instead (fallback).

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";

export interface MushafPagesProps {
  config: MushafConfig;
  surah: number;
  fromAyah: number;
  toAyah: number;
  /** a word of the range, its glyph wrapped by the caller (span 2: one glyph for two words, see page.ts); default: the glyph */
  word?: (key: string, glyph: ReactNode, span?: 2) => ReactNode;
  /** an ayah of the range, at its end glyph (its number): the glyph wrapped by the caller; default: the glyph */
  end?: (ayah: number, glyph: ReactNode) => ReactNode;
  /** the range's ayat fromAyah..toAyah of a page that couldn't be drawn, in the old view */
  fallback: (fromAyah: number, toAyah: number) => ReactNode;
}

export function MushafPages(props: MushafPagesProps) {
  const pages = pagesOf(props.surah, props.fromAyah, props.toAyah);
  return (
    <div className={styles.pages} dir="rtl" lang="ar">
      {pages.map((p, i) => (
        <Fragment key={p}>
          {i > 0 && (
            <div className={styles.divider} role="separator">
              <span>صفحة {toArabicDigits(p)}</span>
            </div>
          )}
          <PageView page={p} {...props} />
        </Fragment>
      ))}
      <div className={styles.attribution}>
        المصحف وخطوطه من مجمّع الملك فهد لطباعة المصحف الشريف؛ تُحمَّل الخطوط عن طريق مؤسسة القرآن (Quran Foundation)، وبيانات الصفحات والأسطر من مكتبة QUL (Tarteel).
      </div>
    </div>
  );
}

type State = { status: "idle" | "loading" } | { status: "ready"; data: MushafPage; family: string } | { status: "failed" };

function PageView({ page, config, surah, fromAyah, toAyah, word, end, fallback }: MushafPagesProps & { page: number }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const box = useRef<HTMLDivElement>(null);
  // the widest line's width per 1px of font size (measured once the font is in), and the box's width
  const [ratio, setRatio] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  // load only when the page comes near the screen (a long range doesn't fetch every font up front)
  useEffect(() => {
    const el = box.current;
    if (!el || state.status !== "idle") return;
    const start = () => {
      setState({ status: "loading" });
      Promise.all([loadMushafPage(page), loadPageFont(config.fontBase, page)]).then(
        ([data, family]) => setState({ status: "ready", data, family }),
        () => setState({ status: "failed" }),
      );
    };
    if (typeof IntersectionObserver === "undefined") return start();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [page, config.fontBase, state.status]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // the lines' width: the box without its padding
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // measure the natural width of the lines at a known size, once per page (before the first paint)
  const measure = (el: HTMLDivElement | null) => {
    if (!el) return;
    let widest = 0;
    el.querySelectorAll<HTMLElement>(`.${styles.measureLine}`).forEach((line) => {
      widest = Math.max(widest, line.scrollWidth);
    });
    if (widest > 0) setRatio(widest / MEASURE_PX);
  };

  const inRange = (key: string) => {
    const k = parseKey(key);
    return k.surah === surah && k.ayah >= fromAyah && k.ayah <= toAyah;
  };

  let body: ReactNode;
  if (state.status === "failed") {
    // the range's ayat with words on this page, by the bundled page map
    const entries = getAyahPageEntries(surah) ?? [];
    const here: number[] = [];
    for (let a = fromAyah; a <= toAyah; a++) {
      const e = entries[a - 1];
      if (e && e[1] <= page && page <= e[2]) here.push(a);
    }
    body = (
      <div className={styles.fallback}>
        <div className={styles.fallbackNote} role="status">
          تعذّر تحميل خطّ صفحة المصحف {toArabicDigits(page)}، فعُرضت آياتها بالنص العادي.
        </div>
        {here.length > 0 && fallback(here[0], here[here.length - 1])}
      </div>
    );
  } else if (state.status !== "ready") {
    body = (
      <div className={styles.placeholder} role="status">
        جارٍ تحميل صفحة المصحف…
      </div>
    );
  } else {
    const { data, family } = state;
    const measuring = ratio === null;
    // a hair under the width: rounding never pushes a line over
    const fontSize = measuring ? MEASURE_PX : Math.max(8, (width * 0.985) / ratio);
    const head = pageHeader(data);
    const glyph = (g: string) => <span aria-hidden="true">{g}</span>;
    const entry = (e: MushafEntry) => {
      const [key, g, span] = e;
      const k = parseKey(key);
      if (!inRange(key)) {
        return (
          <span key={key} className={styles.out} aria-hidden="true">
            {g}
          </span>
        );
      }
      if (k.word === 0) return <Fragment key={key}>{end ? end(k.ayah, glyph(g)) : <span className={styles.end}>{glyph(g)}</span>}</Fragment>;
      return <Fragment key={key}>{word ? word(key, glyph(g), span) : <span className={styles.w}>{glyph(g)}</span>}</Fragment>;
    };
    body = (
      <>
        <div className={styles.pageHead} aria-hidden="true">
          <span>سورة {SURAH_NAME[head.surah]}</span>
          <span>الجزء {toArabicDigits(head.juz)}</span>
        </div>
        <div
          ref={measuring ? measure : undefined}
          className={`${styles.page} ${measuring ? styles.measuring : ""}`}
          style={{ fontFamily: `"${family}"`, fontSize: `${fontSize}px` }}
          role="group"
          aria-label={`صفحة المصحف ${toArabicDigits(page)}`}
        >
          {data.lines.map((line, i) =>
            line.t === "s" ? (
              <div key={i} className={`${styles.surahLine} ${quranFont.className}`} aria-hidden="true">
                <span className={styles.surahFrame}>سورة {SURAH_NAME[line.s]}</span>
              </div>
            ) : line.t === "b" ? (
              <div key={i} className={`${styles.basmalaLine} ${quranFont.className}`} aria-hidden="true">
                {BASMALA}
              </div>
            ) : (
              <div key={i} className={`${styles.line} ${measuring ? styles.measureLine : ""} ${line.c ? styles.centred : ""}`}>
                {line.w.map(entry)}
              </div>
            ),
          )}
        </div>
        <div className={styles.pageFoot} aria-hidden="true">
          {toArabicDigits(page)}
        </div>
      </>
    );
  }

  return (
    <div ref={box} className={styles.pageBox}>
      {body}
    </div>
  );
}

const MEASURE_PX = 40;
