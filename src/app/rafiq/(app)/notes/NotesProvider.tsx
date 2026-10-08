"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import styles from "./notes.module.css";
import { VerseNotesPanel } from "./VerseNotesPanel";
import { useSurahText } from "@/components/home-log/useSurahText";
import { quranFont } from "@/components/mistakes/quran-font";
import { SURAH_NAME } from "@/lib/quran-data";
import { ayahOnly } from "@/lib/quran-data/words";
import { NOTE_COLORS, verseKey, type NoteSummary } from "@/lib/rafiq/notes-rules";
import type { GroupGender } from "@/lib/text/gender";

// Her note markers across Rafiq: the layout loads which verses have notes,
// and any marker opens that verse's notes in one shared dialog.

type Ctx = { summary: NoteSummary; g: GroupGender; open: (surah: number, ayah: number) => void };
const NotesCtx = createContext<Ctx | null>(null);

export function NotesProvider({ summary, g, children }: { summary: NoteSummary; g: GroupGender; children: ReactNode }) {
  const [verse, setVerse] = useState<{ surah: number; ayah: number } | null>(null);
  return (
    <NotesCtx.Provider value={{ summary, g, open: (surah, ayah) => setVerse({ surah, ayah }) }}>
      {children}
      {verse && <VerseNotesDialog {...verse} g={g} onClose={() => setVerse(null)} />}
    </NotesCtx.Provider>
  );
}

/** The small button after a verse number: a coloured dot and count, or a faint ✎ to add one. */
export function VerseNoteMarker({ surah, ayah }: { surah: number; ayah: number }) {
  const ctx = useContext(NotesCtx);
  if (!ctx) return null;
  const s = ctx.summary[verseKey(surah, ayah)];
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.open(surah, ayah);
  };
  if (!s) {
    return (
      <button type="button" className={`${styles.marker} ${styles.markerEmpty}`} onClick={open} aria-label={`إضافة ملاحظة على الآية ${ayah}`} title="إضافة ملاحظة">
        ✎
      </button>
    );
  }
  const c = s.color ? NOTE_COLORS[s.color] : null;
  return (
    <button
      type="button"
      className={styles.marker}
      style={{ background: c?.bg ?? "var(--cream)", color: c?.fg ?? "var(--ink-soft)" }}
      onClick={open}
      aria-label={`ملاحظاتي على الآية ${ayah} (${s.count})`}
      title="ملاحظاتي على هذه الآية"
    >
      <span className={styles.markerDot} style={{ background: c?.dot ?? "var(--lavender)" }} />
      {s.count > 1 && s.count}
    </button>
  );
}

function VerseNotesDialog({ surah, ayah, g, onClose }: { surah: number; ayah: number; g: GroupGender; onClose: () => void }) {
  const raw = useSurahText(surah)?.[ayah - 1];
  const text = raw && ayahOnly(surah, ayah, raw);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="verse-notes-title" onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHead}>
          <div className={styles.dialogTitle} id="verse-notes-title">
            ملاحظاتي · سورة {SURAH_NAME[surah]} · الآية {ayah}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </div>
        <div className={`${styles.verseText} ${quranFont.className}`} lang="ar">
          {text ?? "…"} <span style={{ color: "var(--gold)" }}>﴿{ayah}﴾</span>
        </div>
        <VerseNotesPanel surah={surah} ayah={ayah} g={g} />
        <div className={styles.formRow} style={{ justifyContent: "space-between" }}>
          <Link href={`/rafiq/verse/${surah}/${ayah}`} className={styles.linkBtn} onClick={onClose}>
            صفحة الآية ←
          </Link>
          <Link href="/rafiq/notes" className={styles.linkBtn} onClick={onClose}>
            كل ملاحظاتي ←
          </Link>
        </div>
      </div>
    </div>
  );
}
