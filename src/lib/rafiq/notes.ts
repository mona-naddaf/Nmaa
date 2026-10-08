import "server-only";
import { prisma } from "@/lib/db";
import {
  DEFAULT_NOTE_TAGS,
  isNoteColor,
  verseKey,
  type NoteSummary,
  type NoteTag,
  type VerseNote,
} from "@/lib/rafiq/notes-rules";

// Her verse notes and their tags («رفيق الحفظ»). Every query here is scoped
// to her own id; actions (src/app/rafiq/(app)/notes/actions.ts) check the rest.

const NOTE_SELECT = {
  id: true,
  surahNumber: true,
  ayah: true,
  text: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { tagId: true, tag: { select: { sortOrder: true, createdAt: true } } } },
} as const;

type NoteRow = {
  id: string;
  surahNumber: number;
  ayah: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  tags: { tagId: string; tag: { sortOrder: number; createdAt: Date } }[];
};

const byTagOrder = (a: NoteRow["tags"][number], b: NoteRow["tags"][number]) =>
  a.tag.sortOrder - b.tag.sortOrder || a.tag.createdAt.getTime() - b.tag.createdAt.getTime();

function toNote(r: NoteRow): VerseNote {
  return {
    id: r.id,
    surahNumber: r.surahNumber,
    ayah: r.ayah,
    text: r.text,
    tagIds: [...r.tags].sort(byTagOrder).map((t) => t.tagId),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Her tags, creating the three defaults once (the first time she opens her notes). */
export async function ensureNoteTags(userId: string): Promise<NoteTag[]> {
  const claimed = await prisma.rafiqUser.updateMany({
    where: { id: userId, noteTagsSeededAt: null },
    data: { noteTagsSeededAt: new Date() },
  });
  if (claimed.count > 0) {
    await prisma.rafiqNoteTag.createMany({
      data: DEFAULT_NOTE_TAGS.map((t, i) => ({ userId, name: t.name, color: t.color, sortOrder: i })),
      skipDuplicates: true,
    });
  }
  return getNoteTags(userId);
}

export async function getNoteTags(userId: string): Promise<NoteTag[]> {
  const rows = await prisma.rafiqNoteTag.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true },
  });
  return rows.map((t) => ({ id: t.id, name: t.name, color: isNoteColor(t.color) ? t.color : "sand" }));
}

/** The marker data for every verse she has notes on. */
export async function getNoteSummary(userId: string): Promise<NoteSummary> {
  const rows = await prisma.rafiqNote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      surahNumber: true,
      ayah: true,
      tags: { select: { tag: { select: { color: true, sortOrder: true, createdAt: true } } } },
    },
  });
  const out: NoteSummary = {};
  for (const r of rows) {
    const k = verseKey(r.surahNumber, r.ayah);
    if (out[k]) {
      out[k].count++;
      continue;
    }
    // newest note first: its first tag gives the marker's colour
    const first = [...r.tags].sort(
      (a, b) => a.tag.sortOrder - b.tag.sortOrder || a.tag.createdAt.getTime() - b.tag.createdAt.getTime(),
    )[0];
    out[k] = { count: 1, color: first && isNoteColor(first.tag.color) ? first.tag.color : null };
  }
  return out;
}

export async function getVerseNotes(userId: string, surahNumber: number, ayah: number): Promise<VerseNote[]> {
  const rows = await prisma.rafiqNote.findMany({
    where: { userId, surahNumber, ayah },
    orderBy: { createdAt: "desc" },
    select: NOTE_SELECT,
  });
  return rows.map(toNote);
}

export type NotesFilter = { tagIds: string[]; surah: number | null; q: string };

/** «ملاحظاتي»: newest first. Several tags = notes with any of them. */
export async function listNotes(userId: string, f: NotesFilter, take: number): Promise<{ notes: VerseNote[]; total: number }> {
  const where = {
    userId,
    ...(f.surah ? { surahNumber: f.surah } : {}),
    ...(f.tagIds.length ? { tags: { some: { tagId: { in: f.tagIds } } } } : {}),
    ...(f.q ? { text: { contains: f.q, mode: "insensitive" as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.rafiqNote.findMany({ where, orderBy: { createdAt: "desc" }, take, select: NOTE_SELECT }),
    prisma.rafiqNote.count({ where }),
  ]);
  return { notes: rows.map(toNote), total };
}

/** The surahs she has notes in, for the filter. */
export async function notedSurahs(userId: string): Promise<number[]> {
  const rows = await prisma.rafiqNote.groupBy({ by: ["surahNumber"], where: { userId }, orderBy: { surahNumber: "asc" } });
  return rows.map((r) => r.surahNumber);
}
