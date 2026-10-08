import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { surahText } from "@/lib/quran-data/quran-text";
import { ayahOnly, hasBasmalaPrefix } from "@/lib/quran-data/words";
import { quranFont } from "@/components/mistakes/quran-font";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../../notes/notes.module.css";
import { VerseNotesPanel } from "../../../notes/VerseNotesPanel";

// One verse with the verses around it and her notes on it (where «ملاحظاتي»
// links to).
export default async function RafiqVersePage({ params }: PageProps<"/rafiq/verse/[surah]/[ayah]">) {
  const user = await requireRafiqUser();
  const { surah: sRaw, ayah: aRaw } = await params;
  const surah = Number(sRaw);
  const ayah = Number(aRaw);
  const count = Number.isInteger(surah) ? AYAH_COUNT[surah] : undefined;
  const text = count && Number.isInteger(ayah) && ayah >= 1 && ayah <= count ? surahText(surah) : null;
  if (!count || !text) notFound();
  const verse = (a: number) => ayahOnly(surah, a, text[a - 1]);
  const basmala = hasBasmalaPrefix(surah, 1) && ayah <= 2 ? text[0].split(" ").slice(0, 4).join(" ") : null;

  return (
    <div className={styles.versePage}>
      <Link href="/rafiq/notes" className={styles.linkBtn}>
        → ملاحظاتي
      </Link>
      <div className={hl.sectionTitle} style={{ marginTop: 8 }}>
        سورة {SURAH_NAME[surah]} · الآية {ayah}
      </div>
      <div className={`${hl.section} ${quranFont.className}`} lang="ar">
        {basmala && <div className={styles.verseNeighbour} style={{ textAlign: "center" }}>{basmala}</div>}
        {ayah > 1 && (
          <div className={styles.verseNeighbour}>
            {verse(ayah - 1)} <span>﴿{ayah - 1}﴾</span>
          </div>
        )}
        <div className={styles.verseMain}>
          {verse(ayah)} <span style={{ color: "var(--gold)" }}>﴿{ayah}﴾</span>
        </div>
        {ayah < count && (
          <div className={styles.verseNeighbour}>
            {verse(ayah + 1)} <span>﴿{ayah + 1}﴾</span>
          </div>
        )}
      </div>
      <div className={styles.verseNav}>
        {ayah > 1 ? (
          <Link href={`/rafiq/verse/${surah}/${ayah - 1}`} className={styles.ghostBtn}>
            → الآية السابقة
          </Link>
        ) : (
          <span />
        )}
        {ayah < count && (
          <Link href={`/rafiq/verse/${surah}/${ayah + 1}`} className={styles.ghostBtn}>
            الآية التالية ←
          </Link>
        )}
      </div>
      <div className={hl.sectionTitle} style={{ marginTop: 18 }}>
        📝 ملاحظاتي على هذه الآية
      </div>
      <div className={hl.section}>
        <VerseNotesPanel key={`${surah}:${ayah}`} surah={surah} ayah={ayah} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"} />
      </div>
    </div>
  );
}
