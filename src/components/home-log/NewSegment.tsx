"use client";

import { useState, useTransition } from "react";
import { SimilarAfter, SimilarEnd } from "@/components/quran/Similar";
import { useRouter } from "next/navigation";
import styles from "./home-log.module.css";
import { useSurahText } from "./useSurahText";
import { quranFont } from "@/components/mistakes/quran-font";
import { AYAH_COUNT, SURAHS } from "@/lib/quran-data";
import { HOME_LIMITS } from "@/lib/home-log/rules";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import type { MushafConfig } from "@/lib/mushaf/enabled";
import { ayahOnly } from "@/lib/quran-data/words";
import { MushafToggle } from "@/components/mushaf/MushafToggle";
import { MushafPages } from "@/components/mushaf/MushafPages";
import { useMushafView } from "@/components/mushaf/useMushafView";
import mushafStyles from "@/components/mushaf/mushaf.module.css";
import { pageHighlight, useHighlights, wordCounter, type HighlightConfig } from "@/components/highlight/useHighlights";
import { BandedAyah, HighlightBar, HighlightModeText } from "@/components/highlight/HighlightUI";

/**
 * Picking a new segment: her plan's surahs first, the text as a preview.
 * create: saves it and returns its id; then she goes to practiceBase/id.
 * suggestionNote: what the pre-filled suggestion is, after «★ سور خطتك ·»
 * (planMark: that label, for whose plan it is — «العائلة»: «★ سور خطة عمر»).
 * rangeHint: a line under «إلى الآية» (Rafiq and «العائلة»: the 40-ayah limit).
 */
export function NewSegment({
  g,
  plan,
  suggestion,
  suggestionNote,
  planMark = "★ سور خطتك",
  create,
  practiceBase,
  onCancel,
  afterAyah,
  rangeHint,
  mushaf,
  mushafFeminine = g === "GIRLS",
  belowPage,
  highlight,
}: {
  g: GroupGender;
  plan: number[];
  suggestion: { surahNumber: number; fromAyah: number; toAyah: number };
  suggestionNote: string;
  planMark?: string;
  create: (input: { surahNumber: number; fromAyah: number; toAyah: number }) => Promise<{ error?: string; id?: string }>;
  practiceBase: string;
  onCancel: () => void;
  // anything to show right after each ayah number in the preview (e.g. a note marker)
  afterAyah?: (ayah: number, surah: number) => React.ReactNode;
  rangeHint?: string;
  // «صفحة المصحف» offered (Rafiq and «العائلة», MUSHAF_VIEW_EMAILS); unset: the plain preview, as before
  mushaf?: MushafConfig;
  // whom the toggle's hint speaks to (default: by g)
  mushafFeminine?: boolean;
  // under the Mushaf page (nothing may sit on it): e.g. her noted verses
  belowPage?: (surah: number, fromAyah: number, toAyah: number) => React.ReactNode;
  // «التظليل» (Rafiq and «العائلة», HIGHLIGHT_EMAILS); unset: none, as before
  highlight?: HighlightConfig;
}) {
  const router = useRouter();
  const [surah, setSurah] = useState(suggestion.surahNumber);
  const [from, setFrom] = useState(suggestion.fromAyah);
  const [to, setTo] = useState(suggestion.toAyah);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ayahs = useSurahText(surah);
  const hl = useHighlights(highlight, surah, wordCounter(surah, ayahs));
  const count = AYAH_COUNT[surah] ?? 1;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const view = useMushafView();
  // the ayat as plain text: the old preview, and a Mushaf page's fallback
  const preview = (a1: number, a2: number) =>
    hl.mode && ayahs ? (
      <HighlightModeText hl={hl} surah={surah} fromAyah={a1} toAyah={a2} text={ayahs} className={`${styles.preview} ${quranFont.className}`} />
    ) : (
    <div className={`${styles.preview} ${quranFont.className}`} lang="ar">
      {ayahs
        ? ayahs.slice(a1 - 1, a2).map((t, i) => (
            <span key={a1 + i}>
              {(hl.on && BandedAyah({ hl, surah, ayah: a1 + i, text: t })) || t} <span className={styles.ayahNum}>﴿{a1 + i}﴾</span>
              <SimilarAfter surah={surah} ayah={a1 + i} />
              {afterAyah?.(a1 + i, surah)}{" "}
            </span>
          ))
        : "…"}
    </div>
  );

  // her plan's surahs first, then the rest of the Quran
  const planSet = new Set(plan);
  const ordered = [...plan.map((n) => SURAHS.find((s) => s.number === n)!).filter(Boolean), ...SURAHS.filter((s) => !planSet.has(s.number))];

  function changeSurah(n: number) {
    setSurah(n);
    setFrom(1);
    setTo(Math.min(AYAH_COUNT[n] ?? 1, 10));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await create({ surahNumber: surah, fromAyah: from, toAyah: to });
      if (r.error) return setError(r.error);
      router.push(`${practiceBase}/${r.id}`);
    });
  }

  const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle} style={{ margin: "0 0 10px" }}>
        مقطع جديد
      </div>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="seg-surah">السورة</label>
          <select id="seg-surah" className={styles.select} value={surah} onChange={(e) => changeSurah(Number(e.target.value))}>
            {ordered.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
                {planSet.has(s.number) ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="seg-from">من الآية</label>
          <select
            id="seg-from"
            className={styles.select}
            value={from}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFrom(v);
              if (to < v) setTo(v);
              if (to - v + 1 > HOME_LIMITS.maxAyat) setTo(v + HOME_LIMITS.maxAyat - 1);
            }}
          >
            {range(1, count).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="seg-to">إلى الآية</label>
          <select id="seg-to" className={styles.select} value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {range(from, Math.min(count, from + HOME_LIMITS.maxAyat - 1)).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {rangeHint && (
            <div className={styles.muted} style={{ marginTop: 4 }}>
              {rangeHint}
            </div>
          )}
        </div>
      </div>
      <div className={styles.muted} style={{ marginBottom: 6 }}>
        {planMark} · {suggestionNote}
      </div>
      {mushaf && <MushafToggle feminine={mushafFeminine} />}
      {hl.on && <HighlightBar hl={hl} />}
      {mushaf && view === "page" && ayahs ? (
        <>
          <MushafPages
            config={mushaf}
            surah={surah}
            fromAyah={from}
            toAyah={to}
            // nothing on the page: a verse with similar verses has its number tinted and tappable
            end={(a, glyph) => (
              <span className={mushafStyles.endWrap}>
                <SimilarEnd surah={surah} ayah={a}>
                  {glyph}
                </SimilarEnd>
                <span className={mushafStyles.srOnly}>
                  {ayahOnly(surah, a, ayahs[a - 1] ?? "")} ﴿{a}﴾
                </span>
              </span>
            )}
            fallback={preview}
            {...pageHighlight(hl, surah, ayahs)}
          />
          {belowPage?.(surah, from, to)}
        </>
      ) : (
        preview(from, to)
      )}
      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.primaryBtn} onClick={save} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : p("ابدأ هذا المقطع", "ابدئي هذا المقطع")}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onCancel} disabled={pending}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
