"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { AYAH_COUNT } from "@/lib/quran-data";
import { ensureNoteTags, getVerseNotes } from "@/lib/rafiq/notes";
import {
  cleanNoteText,
  cleanTagIds,
  cleanTagName,
  isNoteColor,
  NOTE_LIMITS,
  type NoteTag,
  type VerseNote,
} from "@/lib/rafiq/notes-rules";

// Her verse notes and tags. Every action re-checks her session, and that
// each note and tag it touches is hers.

type Result = { error?: string };

const SIGNED_OUT = { error: "انتهت الجلسة، يُرجى تسجيل الدخول مرة أخرى" };

async function userId() {
  return (await getRafiqUser())?.id ?? null;
}

function refresh() {
  // the markers live in every Rafiq page that shows verse text
  revalidatePath("/rafiq", "layout");
}

function realVerse(surahNumber: unknown, ayah: unknown): { surahNumber: number; ayah: number } | null {
  const s = Number(surahNumber);
  const a = Number(ayah);
  if (!Number.isInteger(s) || !Number.isInteger(a) || !AYAH_COUNT[s] || a < 1 || a > AYAH_COUNT[s]) return null;
  return { surahNumber: s, ayah: a };
}

/** Tag ids that really are hers, or an error. */
async function ownTagIds(uid: string, input: unknown): Promise<string[] | { error: string }> {
  const ids = cleanTagIds(input);
  if (!Array.isArray(ids)) return ids;
  if (ids.length === 0) return [];
  const found = await prisma.rafiqNoteTag.count({ where: { userId: uid, id: { in: ids } } });
  return found === ids.length ? ids : { error: "أحد الوسوم المختارة لم يعد موجودًا" };
}

/** One verse's notes for the panel, with her tags (created on first use). */
export async function loadVerseNotesAction(
  surahNumber: number,
  ayah: number,
): Promise<{ error: string } | { notes: VerseNote[]; tags: NoteTag[] }> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const verse = realVerse(surahNumber, ayah);
  if (!verse) return { error: "هذه الآية غير موجودة" };
  const [tags, notes] = await Promise.all([ensureNoteTags(uid), getVerseNotes(uid, verse.surahNumber, verse.ayah)]);
  return { notes, tags };
}

export async function saveNoteAction(input: {
  id?: string;
  surahNumber: number;
  ayah: number;
  text: string;
  tagIds: string[];
}): Promise<Result & { note?: VerseNote }> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const text = cleanNoteText(input?.text);
  if ("error" in text) return text;
  const tagIds = await ownTagIds(uid, input?.tagIds);
  if (!Array.isArray(tagIds)) return tagIds;

  if (input?.id) {
    const note = await prisma.rafiqNote.findFirst({
      where: { id: String(input.id), userId: uid },
      select: { id: true, surahNumber: true, ayah: true },
    });
    if (!note) return { error: "هذه الملاحظة غير موجودة — ربما حُذفت" };
    await prisma.$transaction([
      prisma.rafiqNote.update({ where: { id: note.id }, data: { text: text.text } }),
      prisma.rafiqNoteTagLink.deleteMany({ where: { noteId: note.id } }),
      prisma.rafiqNoteTagLink.createMany({ data: tagIds.map((tagId) => ({ noteId: note.id, tagId })) }),
    ]);
    refresh();
    return { note: (await getVerseNotes(uid, note.surahNumber, note.ayah)).find((n) => n.id === note.id) };
  }

  const verse = realVerse(input?.surahNumber, input?.ayah);
  if (!verse) return { error: "هذه الآية غير موجودة" };
  const [onVerse, total, today] = await Promise.all([
    prisma.rafiqNote.count({ where: { userId: uid, ...verse } }),
    prisma.rafiqNote.count({ where: { userId: uid } }),
    prisma.rafiqNote.count({ where: { userId: uid, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  if (onVerse >= NOTE_LIMITS.perVerse) return { error: `وصلت ملاحظات هذه الآية إلى حدّها (${NOTE_LIMITS.perVerse})` };
  if (total >= NOTE_LIMITS.perAccount) return { error: `وصلت الملاحظات إلى حدّها (${NOTE_LIMITS.perAccount})` };
  if (today >= NOTE_LIMITS.perDay) return { error: "ملاحظات كثيرة اليوم — يُرجى المتابعة غدًا" };
  const created = await prisma.rafiqNote.create({
    data: { userId: uid, ...verse, text: text.text, tags: { create: tagIds.map((tagId) => ({ tagId })) } },
    select: { id: true },
  });
  refresh();
  return { note: (await getVerseNotes(uid, verse.surahNumber, verse.ayah)).find((n) => n.id === created.id) };
}

export async function deleteNoteAction(id: string): Promise<Result> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const { count } = await prisma.rafiqNote.deleteMany({ where: { id: String(id ?? ""), userId: uid } });
  if (count === 0) return { error: "هذه الملاحظة غير موجودة" };
  refresh();
  return {};
}

export async function saveTagAction(input: { id?: string; name: string; color: string }): Promise<Result> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const name = cleanTagName(input?.name);
  if ("error" in name) return name;
  if (!isNoteColor(input?.color)) return { error: "هذا اللون غير متاح" };
  const color = input.color;

  const clash = await prisma.rafiqNoteTag.findFirst({
    where: { userId: uid, name: name.name, ...(input.id ? { NOT: { id: String(input.id) } } : {}) },
    select: { id: true },
  });
  if (clash) return { error: "يوجد وسم بهذا الاسم" };

  try {
    if (input.id) {
      const { count } = await prisma.rafiqNoteTag.updateMany({
        where: { id: String(input.id), userId: uid },
        data: { name: name.name, color },
      });
      if (count === 0) return { error: "هذا الوسم غير موجود" };
    } else {
      const [count, last] = await Promise.all([
        prisma.rafiqNoteTag.count({ where: { userId: uid } }),
        prisma.rafiqNoteTag.findFirst({ where: { userId: uid }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
      ]);
      if (count >= NOTE_LIMITS.tagsPerAccount) return { error: `وصلت الوسوم إلى حدّها (${NOTE_LIMITS.tagsPerAccount})` };
      // creating a tag counts as opening her notes: the defaults won't appear later
      await prisma.rafiqUser.updateMany({ where: { id: uid, noteTagsSeededAt: null }, data: { noteTagsSeededAt: new Date() } });
      await prisma.rafiqNoteTag.create({ data: { userId: uid, name: name.name, color, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    }
  } catch {
    return { error: "يوجد وسم بهذا الاسم" };
  }
  refresh();
  return {};
}

/** Removes the tag from her notes; the notes themselves stay. */
export async function deleteTagAction(id: string): Promise<Result> {
  const uid = await userId();
  if (!uid) return SIGNED_OUT;
  const { count } = await prisma.rafiqNoteTag.deleteMany({ where: { id: String(id ?? ""), userId: uid } });
  if (count === 0) return { error: "هذا الوسم غير موجود" };
  refresh();
  return {};
}
