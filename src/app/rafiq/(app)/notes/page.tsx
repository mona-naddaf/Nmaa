import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { ensureNoteTags, listNotes, notedSurahs } from "@/lib/rafiq/notes";
import { NOTE_COLORS, notesCountText } from "@/lib/rafiq/notes-rules";
import { AYAH_COUNT, SURAH_NAME } from "@/lib/quran-data";
import { surahText } from "@/lib/quran-data/quran-text";
import { ayahOnly } from "@/lib/quran-data/words";
import { quranFont } from "@/components/mistakes/quran-font";
import { pickByGroup } from "@/lib/text/gender";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./notes.module.css";
import { TagChip } from "./TagChip";
import { TagManager } from "./TagManager";

const PAGE = 50;

// «ملاحظاتي»: all her verse notes, newest first, filtered by tags (any of
// them), surah and text. Each note links to its verse page.
export default async function RafiqNotesPage({ searchParams }: PageProps<"/rafiq/notes">) {
  const user = await requireRafiqUser();
  const g = user.gender === "FEMALE" ? "GIRLS" : "BOYS";
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const sp = await searchParams;

  const tags = await ensureNoteTags(user.id);
  const tagIds = [sp.tag].flat().filter((id): id is string => typeof id === "string" && tags.some((t) => t.id === id));
  const surahN = Number(sp.surah);
  const surah = Number.isInteger(surahN) && AYAH_COUNT[surahN] ? surahN : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const take = Math.min(Math.max(Number(sp.n) || PAGE, PAGE), 1000);

  const [{ notes, total }, surahs, links] = await Promise.all([
    listNotes(user.id, { tagIds, surah, q }, take),
    notedSurahs(user.id),
    prisma.rafiqNoteTagLink.groupBy({ by: ["tagId"], where: { tagId: { in: tags.map((t) => t.id) } }, _count: true }),
  ]);
  const counts = Object.fromEntries(links.map((l) => [l.tagId, l._count]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const filtered = tagIds.length > 0 || surah !== null || q !== "";

  const href = (next: { tagIds?: string[]; n?: number }) => {
    const u = new URLSearchParams();
    for (const id of next.tagIds ?? tagIds) u.append("tag", id);
    if (surah) u.set("surah", String(surah));
    if (q) u.set("q", q);
    if (next.n) u.set("n", String(next.n));
    const s = u.toString();
    return s ? `/rafiq/notes?${s}` : "/rafiq/notes";
  };

  return (
    <div className={styles.versePage}>
      <div className={hl.sectionTitle}>📝 ملاحظاتي</div>
      <p className={hl.muted} style={{ margin: "0 4px 12px" }}>
        ملاحظاتك على الآيات: متشابهات، تدبّر، تفسير، أو ما {p("تشاء", "تشائين")}. {p("أضف", "أضيفي")} ملاحظة من علامة ✎ بعد رقم أي آية في
        جلساتك أو حفظك في البيت.
      </p>

      <div className={hl.section}>
        <div className={styles.filters}>
          {tags.length > 0 && (
            <div className={styles.chips} aria-label="تصفية بالوسوم">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                const c = NOTE_COLORS[t.color];
                return (
                  <Link
                    key={t.id}
                    href={href({ tagIds: on ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id] })}
                    className={`${styles.chip} ${on ? styles.chipOn : styles.chipOff}`}
                    style={{ background: c.bg, color: c.fg }}
                    aria-pressed={on}
                    scroll={false}
                  >
                    {on && "✓ "}
                    {t.name}
                  </Link>
                );
              })}
            </div>
          )}
          <form className={styles.filterRow} action="/rafiq/notes">
            {tagIds.map((id) => (
              <input key={id} type="hidden" name="tag" value={id} />
            ))}
            <select name="surah" className={styles.select} defaultValue={surah ?? ""} aria-label="السورة">
              <option value="">كل السور</option>
              {surahs.map((s) => (
                <option key={s} value={s}>
                  {s}. {SURAH_NAME[s]}
                </option>
              ))}
            </select>
            <input name="q" className={styles.input} defaultValue={q} maxLength={100} placeholder="بحث في نصّ الملاحظات" aria-label="بحث" />
            <button type="submit" className={styles.primaryBtn}>
              بحث
            </button>
            {filtered && (
              <Link href="/rafiq/notes" className={styles.ghostBtn}>
                إزالة التصفية
              </Link>
            )}
          </form>
        </div>
      </div>

      <div className={hl.sectionTitle}>
        <span>{filtered ? `النتائج: ${notesCountText(total)}` : notesCountText(total)}</span>
      </div>
      {notes.length === 0 ? (
        <div className={hl.section}>
          <div className={hl.empty}>
            {filtered ? "لا توجد ملاحظات تطابق هذه التصفية." : `لا توجد ملاحظات بعد — ${p("اضغط", "اضغطي")} على ✎ بعد رقم أي آية لتدوين أول ملاحظة.`}
          </div>
        </div>
      ) : (
        notes.map((n) => {
          const raw = surahText(n.surahNumber)?.[n.ayah - 1];
          const verse = raw && ayahOnly(n.surahNumber, n.ayah, raw);
          return (
            <div key={n.id} className={styles.note}>
              <div className={styles.noteHead}>
                <Link href={`/rafiq/verse/${n.surahNumber}/${n.ayah}`} className={styles.noteWhere}>
                  سورة {SURAH_NAME[n.surahNumber]} · الآية {n.ayah}
                </Link>
                <span className={styles.counter}>
                  <bdi dir="ltr">{n.updatedAt.slice(0, 10)}</bdi>
                </span>
              </div>
              {verse && (
                <div className={`${styles.noteVerse} ${quranFont.className}`} lang="ar" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {verse}
                </div>
              )}
              <div className={styles.noteText}>{n.text}</div>
              <div className={styles.noteMeta}>
                <div className={styles.chips}>
                  {n.tagIds.map((id) => {
                    const t = tagById.get(id);
                    return t ? <TagChip key={id} tag={t} /> : null;
                  })}
                </div>
                <span className={styles.spacer} />
                <Link href={`/rafiq/verse/${n.surahNumber}/${n.ayah}`} className={styles.linkBtn}>
                  فتح الآية ←
                </Link>
              </div>
            </div>
          );
        })
      )}
      {notes.length < total && (
        <div className={styles.formRow} style={{ justifyContent: "center", marginBottom: 14 }}>
          <Link href={href({ n: take + PAGE })} className={styles.ghostBtn} scroll={false}>
            عرض المزيد
          </Link>
        </div>
      )}

      <div className={hl.sectionTitle} style={{ marginTop: 18 }}>
        🏷 وسومي
      </div>
      <div className={hl.section}>
        <p className={hl.muted} style={{ marginTop: 0 }}>
          حتى 20 وسمًا بألوان {p("تختارها", "تختارينها")}. حذف الوسم يزيله من الملاحظات، وتبقى الملاحظات نفسها.
        </p>
        <TagManager tags={tags} counts={counts} />
      </div>
    </div>
  );
}
