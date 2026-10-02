import type { StudentInfoBuiltin } from "@prisma/client";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// «معلومات إضافية»: the rules every reader and writer of the extra student
// info shares — labels, who sees which field, and how a submitted value is
// cleaned and checked. Pure (no DB access) so client forms can use the same
// labels and limits; the server actions apply them again either way
// (src/lib/students/extra-info.ts loads and writes the data).

export type InfoBuiltin = StudentInfoBuiltin;

export interface InfoField {
  id: string;
  // null = the supervisor's own field (then label is set)
  builtinKey: InfoBuiltin | null;
  label: string | null;
  enabled: boolean;
  required: boolean;
  visibleToTeachers: boolean;
  visibleToParents: boolean;
  sortOrder: number;
}

/** Who is looking: the supervisor always sees every enabled field. */
export type InfoViewer = "admin" | "teacher" | "parent";

export const BUILTIN_ORDER: InfoBuiltin[] = [
  "MOTHER_NAME",
  "MOTHER_PHONE",
  "MOTHER_JOB",
  "FATHER_NAME",
  "FATHER_PHONE",
  "FATHER_JOB",
  "STUDENT_PHONE",
  "STUDY_OR_WORK",
];

const PHONE_FIELDS: ReadonlySet<InfoBuiltin> = new Set(["MOTHER_PHONE", "FATHER_PHONE", "STUDENT_PHONE"]);

export const MAX_CUSTOM_FIELDS = 20;
export const MAX_LABEL_LENGTH = 40;
const MAX_BUILTIN_VALUE = 200;
const MAX_CUSTOM_VALUE = 500;
const MAX_PHONE_VALUE = 20;

/**
 * A built-in field's name. g = the student's group gender; null = no single
 * group (settings), written «الطالب/ة».
 */
export function builtinLabel(key: InfoBuiltin, g: GroupGender | null): string {
  const student = g === null ? "الطالب/ة" : pickByGroup(g, { m: "الطالب", f: "الطالبة" });
  switch (key) {
    case "MOTHER_NAME":
      return "اسم الأم";
    case "MOTHER_PHONE":
      return "رقم هاتف الأم";
    case "MOTHER_JOB":
      return "مهنة الأم";
    case "FATHER_NAME":
      return "اسم الأب";
    case "FATHER_PHONE":
      return "رقم هاتف الأب";
    case "FATHER_JOB":
      return "مهنة الأب";
    case "STUDENT_PHONE":
      return `رقم هاتف ${student}`;
    case "STUDY_OR_WORK":
      return "مكان الدراسة أو العمل";
  }
}

export function fieldLabel(field: Pick<InfoField, "builtinKey" | "label">, g: GroupGender | null): string {
  return field.builtinKey ? builtinLabel(field.builtinKey, g) : (field.label ?? "");
}

export const isPhoneField = (field: Pick<InfoField, "builtinKey">) =>
  field.builtinKey !== null && PHONE_FIELDS.has(field.builtinKey);

/** Custom fields are free multi-line notes; built-in ones are one line. */
export const isMultilineField = (field: Pick<InfoField, "builtinKey">) => field.builtinKey === null;

export function maxValueLength(field: Pick<InfoField, "builtinKey">): number {
  if (isPhoneField(field)) return MAX_PHONE_VALUE;
  return field.builtinKey ? MAX_BUILTIN_VALUE : MAX_CUSTOM_VALUE;
}

/** Whether this viewer sees the field at all (enabled, and shown to her role). */
export function fieldVisibleTo(field: InfoField, viewer: InfoViewer): boolean {
  if (!field.enabled) return false;
  if (viewer === "teacher") return field.visibleToTeachers;
  if (viewer === "parent") return field.visibleToParents;
  return true;
}

/**
 * Key for "is this the same field name": ignores tashkeel, tatweel, extra
 * spaces and a trailing «*» (the import template marks required columns
 * with one), since the import matches columns by name.
 */
export function infoLabelKey(label: string): string {
  return label
    .normalize("NFC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/\*+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII. */
const asciiDigits = (text: string) => text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));

/**
 * One submitted value, cleaned: trimmed (one-line fields also lose repeated
 * spaces), phones in ASCII digits. "" = cleared. Error text names the field.
 */
export function cleanInfoValue(field: InfoField, raw: unknown, g: GroupGender | null): { value: string } | { error: string } {
  const label = fieldLabel(field, g);
  let value = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  value = isMultilineField(field)
    ? value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : value.replace(/\s+/g, " ").trim();

  if (isPhoneField(field) && value) {
    value = asciiDigits(value);
    if (!/^[0-9+\-\s]+$/.test(value) || !/[0-9]/.test(value)) {
      return { error: `«${label}»: يُرجى إدخال رقم صحيح (أرقام ومسافات و+ و- فقط)` };
    }
  }
  const max = maxValueLength(field);
  if (value.length > max) return { error: `«${label}» أطول من الحد المسموح (${max} حرفًا)` };
  return { value };
}

export type InfoChange = { fieldId: string; value: string | null };

/**
 * Checks a save from someone who may edit `fields` (already filtered to the
 * enabled fields she sees) against the stored values: every submitted value
 * is cleaned, required fields among `fields` must end up filled, and only
 * the fields whose value actually changed come back, so two people editing
 * different fields never overwrite each other. Submitted ids outside
 * `fields` are ignored (never written).
 */
export function validateInfoSave(
  fields: InfoField[],
  current: Record<string, string>,
  submitted: Record<string, unknown>,
  g: GroupGender | null,
): { error: string } | { changes: InfoChange[] } {
  const changes: InfoChange[] = [];
  for (const field of fields) {
    let value = current[field.id] ?? "";
    if (Object.hasOwn(submitted, field.id)) {
      const cleaned = cleanInfoValue(field, submitted[field.id], g);
      if ("error" in cleaned) return cleaned;
      value = cleaned.value;
    }
    if (field.required && !value) return { error: `يُرجى إدخال «${fieldLabel(field, g)}»` };
    if (value !== (current[field.id] ?? "")) changes.push({ fieldId: field.id, value: value || null });
  }
  return { changes };
}

/** How many required fields among `fields` have no value («معلومات ناقصة»). */
export function missingRequiredCount(fields: InfoField[], values: Record<string, string>): number {
  return fields.filter((f) => f.enabled && f.required && !values[f.id]).length;
}
