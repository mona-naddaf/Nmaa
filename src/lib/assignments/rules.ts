// Rules for assignments («الواجبات»), shared by the server actions (which
// enforce them) and the UI (which only mirrors them). Pure: no DB, no
// server-only imports.

import { validateRange } from "@/lib/home-log/rules";

export const ASSIGNMENT_LIMITS = {
  titleMax: 100,
  descriptionMax: 1000,
  // specific students picked for one assignment
  studentsMax: 100,
} as const;

export type AssignmentType = "QURAN" | "QUESTION" | "RESEARCH" | "OTHER";
export const ASSIGNMENT_TYPES: AssignmentType[] = ["QURAN", "QUESTION", "RESEARCH", "OTHER"];

export const ASSIGNMENT_TYPE_LABEL: Record<AssignmentType, string> = {
  QURAN: "حفظ من القرآن",
  QUESTION: "سؤال",
  RESEARCH: "بحث",
  OTHER: "أخرى",
};

export const ASSIGNMENT_TYPE_ICON: Record<AssignmentType, string> = { QURAN: "📖", QUESTION: "❓", RESEARCH: "🔎", OTHER: "📝" };

/** Trimmed, inner whitespace collapsed (newlines kept when multiline). */
export function cleanText(value: unknown, multiline = false): string {
  const s = typeof value === "string" ? value : "";
  return multiline
    ? s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : s.replace(/\s+/g, " ").trim();
}

export interface AssignmentInput {
  title: string;
  description: string | null;
  type: AssignmentType;
  dueDate: string | null; // YYYY-MM-DD
  surahNumber: number | null;
  fromAyah: number | null;
  toAyah: number | null;
}

function isRealDate(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === day;
}

/**
 * Cleans and checks the assignment's own fields (not its targets). QURAN
 * needs a valid range (same limits as a home segment); other types never
 * keep one. homeLogEnabled: D3 — QURAN only while the home log is on.
 */
export function validateAssignment(
  raw: Partial<Record<keyof AssignmentInput, unknown>> | null | undefined,
  homeLogEnabled: boolean,
): { value: AssignmentInput } | { error: string } {
  const title = cleanText(raw?.title);
  if (!title) return { error: "يُرجى كتابة عنوان الواجب" };
  if (title.length > ASSIGNMENT_LIMITS.titleMax) return { error: `يُرجى ألّا يزيد العنوان على ${ASSIGNMENT_LIMITS.titleMax} حرفًا` };
  const description = cleanText(raw?.description, true);
  if (description.length > ASSIGNMENT_LIMITS.descriptionMax) {
    return { error: `يُرجى ألّا يزيد الوصف على ${ASSIGNMENT_LIMITS.descriptionMax} حرف` };
  }
  const type = raw?.type as AssignmentType;
  if (!ASSIGNMENT_TYPES.includes(type)) return { error: "يُرجى اختيار نوع الواجب" };
  const dueRaw = typeof raw?.dueDate === "string" ? raw.dueDate : "";
  if (dueRaw && !isRealDate(dueRaw)) return { error: "تاريخ التسليم غير صحيح" };

  let range = { surahNumber: null as number | null, fromAyah: null as number | null, toAyah: null as number | null };
  if (type === "QURAN") {
    if (!homeLogEnabled) return { error: QURAN_NEEDS_HOME_LOG };
    const surahNumber = Number(raw?.surahNumber);
    const fromAyah = Number(raw?.fromAyah);
    const toAyah = Number(raw?.toAyah);
    const bad = validateRange(surahNumber, fromAyah, toAyah);
    if (bad) return { error: bad };
    range = { surahNumber, fromAyah, toAyah };
  }
  return { value: { title, description: description || null, type, dueDate: dueRaw || null, ...range } };
}

export const QURAN_NEEDS_HOME_LOG = "واجبات الحفظ تحتاج إلى تفعيل «حفظي في البيت» من الإعدادات";

/** Due before her local today (and not done) — shown softly, never as an alarm. */
export function isOverdue(dueDate: string | null, today: string): boolean {
  return dueDate !== null && dueDate < today;
}
