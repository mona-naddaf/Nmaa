// «رفيق الحفظ» verse notes: the fixed tag palette, the limits, and input
// checks. Pure (no database), shared by the server and the client.

export const NOTE_LIMITS = {
  textMax: 2000,
  perVerse: 20,
  perAccount: 5000,
  perDay: 200,
  tagsPerAccount: 20,
  tagNameMax: 30,
  tagsPerNote: 5,
} as const;

/** Soft background, dark text, and a stronger dot, from the site's own tones. */
export const NOTE_COLORS = {
  sage: { name: "ميرمية", bg: "#e3ece4", fg: "#2f5240", dot: "#6f9a7f" },
  rose: { name: "وردي", bg: "#f6e3e1", fg: "#7c3b35", dot: "#c97a72" },
  gold: { name: "ذهبي", bg: "#f6ead2", fg: "#7a4f1c", dot: "#c9963f" },
  olive: { name: "زيتوني", bg: "#e9ead3", fg: "#4f5320", dot: "#8f9440" },
  terracotta: { name: "طيني", bg: "#f3dfd3", fg: "#7d3c22", dot: "#c66a45" },
  slate: { name: "أزرق رمادي", bg: "#e2e7ec", fg: "#34485a", dot: "#6d8499" },
  sand: { name: "رملي", bg: "#efe8da", fg: "#5e5139", dot: "#b09d77" },
  lavender: { name: "خزامى", bg: "#e9e4f0", fg: "#4c3f66", dot: "#8f7fb0" },
} as const;

export type NoteColor = keyof typeof NOTE_COLORS;
export const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];

export function isNoteColor(v: unknown): v is NoteColor {
  return typeof v === "string" && Object.hasOwn(NOTE_COLORS, v);
}

/** Created once, the first time she opens her notes. */
export const DEFAULT_NOTE_TAGS: { name: string; color: NoteColor }[] = [
  { name: "متشابهات", color: "gold" },
  { name: "تدبّر", color: "sage" },
  { name: "تفسير", color: "slate" },
];

export type NoteTag = { id: string; name: string; color: NoteColor };
export type VerseNote = { id: string; surahNumber: number; ayah: number; text: string; tagIds: string[]; createdAt: string; updatedAt: string };
/** Per verse ("surah:ayah"): how many notes, and the colour of the newest note's first tag. */
export type NoteSummary = Record<string, { count: number; color: NoteColor | null }>;

export const verseKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

export function cleanNoteText(v: unknown): { text: string } | { error: string } {
  const text = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
  if (!text) return { error: "نصّ الملاحظة فارغ" };
  if (text.length > NOTE_LIMITS.textMax) return { error: `الملاحظة أطول من ${NOTE_LIMITS.textMax} حرف` };
  return { text };
}

export function cleanTagName(v: unknown): { name: string } | { error: string } {
  const name = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "اسم الوسم فارغ" };
  if (name.length > NOTE_LIMITS.tagNameMax) return { error: `اسم الوسم أطول من ${NOTE_LIMITS.tagNameMax} حرفًا` };
  return { name };
}

/** Unique tag ids, at most tagsPerNote; ownership is checked on the server. */
export function cleanTagIds(v: unknown): string[] | { error: string } {
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64))];
  if (ids.length > NOTE_LIMITS.tagsPerNote) return { error: `يمكن اختيار ${NOTE_LIMITS.tagsPerNote} وسوم على الأكثر للملاحظة الواحدة` };
  return ids;
}

// Arabic number agreement: 1 ملاحظة واحدة، 2 ملاحظتان، 3–10 ملاحظات، 11+ ملاحظة
export function notesCountText(n: number): string {
  if (n === 0) return "لا ملاحظات";
  if (n === 1) return "ملاحظة واحدة";
  if (n === 2) return "ملاحظتان";
  return `${n} ${n % 100 >= 3 && n % 100 <= 10 ? "ملاحظات" : "ملاحظة"}`;
}
