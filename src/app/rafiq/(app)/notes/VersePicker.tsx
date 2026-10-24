"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import { useSurahText } from "@/components/home-log/useSurahText";
import { quranFont } from "@/components/mistakes/quran-font";
import { pointTo } from "@/components/nudge/nudge";
import { ayahOnly } from "@/lib/quran-data/words";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { ayatCount, exactSurah, findSurahs } from "@/lib/rafiq/surah-search";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import styles from "./notes.module.css";
import { useGuideTarget } from "@/components/guide/targets";

/**
 * «+ ملاحظة على آية»: pick a surah by name (or number) and a verse, see the
 * verse, then «فتح الآية» opens its page, where the note is written. The one
 * main button never looks dead: with something missing it points to it.
 */
export function VersePicker({ g }: { g: GroupGender }) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const t = useGuideTarget();
  const [query, setQuery] = useState("");
  // the surah picked from the suggestions (or typed in full)
  const [picked, setPicked] = useState<number | null>(null);
  const [ayahText, setAyahText] = useState("");
  // what is shown as wrong once she presses «فتح الآية»
  const [tried, setTried] = useState(false);
  const surahRef = useRef<HTMLInputElement>(null);
  const ayahRef = useRef<HTMLInputElement>(null);

  const surah = picked ?? exactSurah(query)?.number ?? null;
  const matches = surah === null && query.trim() ? findSurahs(query) : [];
  const count = surah !== null ? AYAH_COUNT[surah] : 0;
  const ayahN = /^\d+$/.test(ayahText.trim()) ? Number(ayahText.trim()) : NaN;
  const ayahOk = surah !== null && Number.isInteger(ayahN) && ayahN >= 1 && ayahN <= count;
  const ayahs = useSurahText(surah ?? 1);
  const preview = ayahOk && surah !== null && ayahs?.[ayahN - 1] ? ayahOnly(surah, ayahN, ayahs[ayahN - 1]) : null;

  const outOfRange = surah !== null && ayahText.trim() !== "" && !ayahOk;
  const noSurah = query.trim() !== "" && surah === null && matches.length === 0;

  function go() {
    if (surah === null) {
      setTried(true);
      return pointTo(surahRef.current);
    }
    if (!ayahOk) {
      setTried(true);
      return pointTo(ayahRef.current);
    }
    router.push(`/rafiq/verse/${surah}/${ayahN}`);
  }

  if (!open)
    return (
      <button type="button" className={styles.primaryBtn} onClick={() => setOpen(true)} {...t("notes.pickVerse")}>
        + ملاحظة على آية
      </button>
    );

  return (
    <div className={hl.section} style={{ width: "100%" }}>
      <div className={styles.pickRow}>
        <div className={styles.pickField}>
          <label htmlFor={`${id}-surah`} className={styles.pickLabel}>
            السورة
          </label>
          <input
            id={`${id}-surah`}
            ref={surahRef}
            className={styles.input}
            value={picked !== null ? SURAH_NAME[picked] : query}
            onChange={(e) => {
              setPicked(null);
              setQuery(e.target.value);
              setTried(false);
            }}
            placeholder={`${p("اكتب", "اكتبي")} اسم السورة، مثل: الكهف`}
            autoComplete="off"
            autoFocus
            aria-describedby={noSurah ? `${id}-nosurah` : undefined}
          />
        </div>
        <div className={styles.pickField} style={{ maxWidth: 130 }}>
          <label htmlFor={`${id}-ayah`} className={styles.pickLabel}>
            رقم الآية
          </label>
          <input
            id={`${id}-ayah`}
            ref={ayahRef}
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={1}
            max={count || undefined}
            value={ayahText}
            onChange={(e) => {
              setAyahText(e.target.value);
              setTried(false);
            }}
            aria-invalid={outOfRange || undefined}
            aria-describedby={outOfRange ? `${id}-range` : undefined}
          />
        </div>
      </div>

      {matches.length > 0 && (
        <div className={styles.chips} style={{ marginTop: 8 }} role="group" aria-label="السور المطابقة">
          {matches.map((s) => (
            <button
              key={s.number}
              type="button"
              className={`${styles.chip} ${styles.chipOff}`}
              onClick={() => {
                setPicked(s.number);
                setQuery(s.name);
                ayahRef.current?.focus();
              }}
            >
              {s.number}. {s.name}
            </button>
          ))}
        </div>
      )}
      {noSurah && (
        <div id={`${id}-nosurah`} className={hl.err} style={{ marginTop: 6 }}>
          لا توجد سورة بهذا الاسم. {p("جرّب", "جرّبي")} كتابة جزء منه.
        </div>
      )}
      {tried && surah === null && !noSurah && (
        <div className={hl.err} role="alert" style={{ marginTop: 6 }}>
          {p("اختر", "اختاري")} السورة أولًا.
        </div>
      )}
      {(outOfRange || (tried && surah !== null && !ayahOk)) && (
        <div id={`${id}-range`} className={hl.err} role="alert" style={{ marginTop: 6 }}>
          سورة {SURAH_NAME[surah!]} فيها {ayatCount(count)}. {p("اكتب", "اكتبي")} رقمًا من 1 إلى {count}.
        </div>
      )}

      {preview && (
        <div className={`${styles.noteVerse} ${quranFont.className}`} lang="ar" style={{ marginTop: 10 }}>
          {preview} ﴿{ayahN}﴾
        </div>
      )}

      <div className={styles.formRow}>
        <button type="button" className={styles.primaryBtn} onClick={go}>
          فتح الآية
        </button>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
