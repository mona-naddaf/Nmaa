import "server-only";
import ExcelJS from "exceljs";
import type { GroupGender, PlanTemplate } from "@prisma/client";
import { AYAH_COUNT, MUSHAF_ORDER, SURAHS, SURAH_NAME } from "@/lib/quran-data";
import {
  PLAN_TEMPLATES,
  PLAN_TEMPLATE_LABEL,
  planRange,
  studentNameKey,
  templatePlan,
  validateNewStudent,
  type NewStudentInput,
  type PriorPartial,
  type ValidatedStudent,
} from "@/lib/students/new-student";
import {
  EXAMPLE_ROW,
  FIRST_DATA_ROW,
  FIXED_HEADERS,
  HEADER_ROW,
  MAIN_SHEET_NAMES,
  exampleRow,
  nameHeader,
  type TemplateVariant,
} from "@/lib/students/import-template";

// Reads an uploaded bulk-import workbook (see import-template.ts) into one
// NewStudentInput per filled row, or a per-row list of reasons it can't be.
// Only the shape of each cell is checked here; the student rules themselves
// (age range, prior surahs in the plan, ayah bounds, …) are applied by the
// caller through validateNewStudent, same as the manual form.

export type ParsedRow = {
  row: number;
  name: string;
  groupName: string;
} & ({ input: NewStudentInput; errors?: undefined } | { input?: undefined; errors: string[] });

export type ParseResult = { error: string } | { variant: TemplateVariant; rows: ParsedRow[]; exampleSkipped: boolean };

const COLUMN_COUNT = 11;

export async function parseImportWorkbook(data: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return { error: "تعذّرت قراءة الملف. يُرجى رفع ملف Excel ‎(.xlsx)‎ من القالب نفسه." };
  }

  const ws =
    wb.getWorksheet(MAIN_SHEET_NAMES.girls) ?? wb.getWorksheet(MAIN_SHEET_NAMES.boys) ?? wb.worksheets[0];
  if (!ws) return { error: "الملف لا يحتوي على أي ورقة." };

  const headers = rowTexts(ws.getRow(HEADER_ROW));
  const variant = (["girls", "boys"] as const).find((v) => headers[0] === nameHeader(v));
  if (!variant || FIXED_HEADERS.some((h, i) => headers[i + 1] !== h)) {
    return {
      error: `رؤوس الأعمدة في السطر ${HEADER_ROW} لا تطابق القالب. يُرجى تحميل القالب من جديد ونقل البيانات إليه دون تعديل رؤوس الأعمدة.`,
    };
  }

  const rows: ParsedRow[] = [];
  let exampleSkipped = false;
  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r++) {
    const cells = rowTexts(ws.getRow(r));
    if (cells.every((c) => c === "")) continue;
    if (r === EXAMPLE_ROW && isUntouchedExample(cells, variant)) {
      exampleSkipped = true;
      continue;
    }
    rows.push(parseRow(r, cells));
  }

  return { variant, rows, exampleSkipped };
}

function parseRow(row: number, cells: string[]): ParsedRow {
  const [name, grade, ageText, groupName, templateText, rangeFromText, rangeToText, scatteredText, partialText, partialFromText, partialToText] =
    cells;
  const errors: string[] = [];

  const age = toInteger(ageText);
  if (!name) errors.push("الاسم فارغ");
  if (!ageText) errors.push("العمر فارغ");
  else if (age == null) errors.push(`العمر «${ageText}» ليس رقمًا صحيحًا`);
  if (!groupName) errors.push("اسم المجموعة فارغ");

  let planTemplate: PlanTemplate | undefined;
  if (!templateText) errors.push("نوع خطة الحفظ فارغ");
  else {
    planTemplate = PLAN_TEMPLATES.find((t) => PLAN_TEMPLATE_LABEL[t] === templateText);
    if (!planTemplate) errors.push(`نوع خطة الحفظ «${templateText}» غير معروف`);
  }
  // custom plans can't be hand-picked from a spreadsheet: they start from
  // plain Mushaf order and can be edited afterwards from the student's page
  const plan = planTemplate ? templatePlan(planTemplate, MUSHAF_ORDER) : [];
  const notInPlan = (n: number) =>
    `سورة ${SURAH_NAME[n]} ليست ضمن خطة «${PLAN_TEMPLATE_LABEL[planTemplate!]}»`;

  // ---------- prior memorization ----------
  const completed = new Set<number>();

  const rangeFrom = parseSurah(rangeFromText, "من سورة", errors);
  const rangeTo = parseSurah(rangeToText, "إلى سورة", errors);
  if (!!rangeFromText !== !!rangeToText) {
    errors.push("يجب تعبئة «من سورة» و«إلى سورة» معًا");
  } else if (rangeFrom != null && rangeTo != null && planTemplate) {
    const range = planRange(plan, rangeFrom, rangeTo);
    if (range) range.forEach((n) => completed.add(n));
    else errors.push(notInPlan(plan.includes(rangeFrom) ? rangeTo : rangeFrom));
  }

  for (const part of scatteredText.split(/[,،;؛]/).map((p) => p.trim()).filter(Boolean)) {
    const n = parseSurah(part, "سور متفرقة", errors);
    if (n == null || !planTemplate) continue;
    if (plan.includes(n)) completed.add(n);
    else errors.push(notInPlan(n));
  }

  let priorPartial: PriorPartial | null = null;
  if (partialText || partialFromText || partialToText) {
    const surahNumber = parseSurah(partialText, "سورة جزئية", errors);
    const fromAyah = toInteger(partialFromText);
    const toAyah = toInteger(partialToText);
    if (!partialText || !partialFromText || !partialToText) {
      errors.push("يجب تعبئة «سورة جزئية» و«من آية» و«إلى آية» معًا");
    } else if (fromAyah == null || toAyah == null) {
      errors.push("أرقام آيات السورة الجزئية يجب أن تكون أرقامًا صحيحة");
    } else if (surahNumber != null && planTemplate) {
      if (!plan.includes(surahNumber)) errors.push(notInPlan(surahNumber));
      else if (completed.has(surahNumber)) {
        errors.push(`سورة ${SURAH_NAME[surahNumber]} مذكورة كسورة جزئية وكسورة محفوظة بالكامل في نفس الوقت`);
      } else priorPartial = { surahNumber, fromAyah, toAyah };
    }
  }

  if (errors.length > 0) return { row, name, groupName, errors };
  return {
    row,
    name,
    groupName,
    input: {
      name,
      grade,
      age: age!,
      planTemplate: planTemplate!,
      plan,
      // in plan order, like the manual form's list
      priorCompletedSurahs: plan.filter((n) => completed.has(n)),
      priorPartial,
    },
  };
}

export interface SkippedRow {
  row: number;
  name: string;
  reason: string;
}

/**
 * Splits parsed rows into students to create and rows to skip (with the
 * reason): names already in the course or earlier in the file are
 * duplicates; the rest go through the same validateNewStudent rules as the
 * manual form.
 */
export function matchImportRows(
  rows: ParsedRow[],
  groups: { id: string; name: string; gender: GroupGender }[],
  existingNames: string[],
): { toCreate: { groupId: string; student: ValidatedStudent }[]; skipped: SkippedRow[] } {
  const groupByName = new Map(groups.map((g) => [g.name.replace(/\s+/g, " ").trim(), g]));
  const existingKeys = new Set(existingNames.map(studentNameKey));
  // name key → row number of the file row that will create that student
  const importedNames = new Map<string, number>();

  const skipped: SkippedRow[] = [];
  const toCreate: { groupId: string; student: ValidatedStudent }[] = [];

  for (const r of rows) {
    const skip = (reason: string) => skipped.push({ row: r.row, name: r.name, reason });
    const key = studentNameKey(r.name);
    if (key && existingKeys.has(key)) {
      skip("مكرَّر: الاسم موجود مسبقًا في الدورة");
      continue;
    }
    if (key && importedNames.has(key)) {
      skip(`مكرَّر: الاسم نفسه في السطر ${importedNames.get(key)}`);
      continue;
    }

    const group = groupByName.get(r.groupName);
    const errors = [...(r.errors ?? [])];
    if (r.groupName && !group) errors.push(`المجموعة «${r.groupName}» غير موجودة في الدورة`);
    if (errors.length > 0 || !r.input || !group) {
      skip(errors.join("، "));
      continue;
    }

    const result = validateNewStudent(r.input, group.gender);
    if ("error" in result) {
      skip(result.error);
      continue;
    }

    importedNames.set(key, r.row);
    toCreate.push({ groupId: group.id, student: result.student });
  }

  return { toCreate, skipped };
}

// ---------- cells ----------

function rowTexts(row: ExcelJS.Row): string[] {
  return Array.from({ length: COLUMN_COUNT }, (_, i) => cellText(row.getCell(i + 1).value));
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    if ("richText" in value) return cellText(value.richText.map((t) => t.text).join(""));
    if ("result" in value) return cellText((value.result ?? null) as ExcelJS.CellValue);
    if ("text" in value) return cellText(value.text as ExcelJS.CellValue);
  }
  return "";
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII. */
function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

function toInteger(text: string): number | null {
  const t = asciiDigits(text);
  return /^\d+$/.test(t) ? Number(t) : null;
}

// Surah names are a fixed list with no collisions under this folding, so
// common spelling variants (البقره, الاعلى, الضحي) can safely match too.
const surahNameKey = (name: string) =>
  name
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/^سورة\s+/, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
const SURAH_BY_NAME = new Map(SURAHS.map((s) => [surahNameKey(s.name), s.number]));

/**
 * A surah cell: "6", "6 - الأنعام" (the dropdown form) or "الأنعام". Empty →
 * null with no error; unrecognised → null plus an error naming the column.
 */
function parseSurah(text: string, column: string, errors: string[]): number | null {
  if (!text) return null;
  const t = asciiDigits(text);
  const numbered = t.match(/^(\d+)\s*(?:[-–—]\s*(.*))?$/);
  if (numbered) {
    const n = Number(numbered[1]);
    const name = numbered[2];
    if (AYAH_COUNT[n] && (!name || SURAH_BY_NAME.get(surahNameKey(name)) === n)) return n;
  } else {
    const n = SURAH_BY_NAME.get(surahNameKey(t));
    if (n) return n;
  }
  errors.push(`«${text}» في عمود «${column}» ليست سورة معروفة`);
  return null;
}

function isUntouchedExample(cells: string[], variant: TemplateVariant): boolean {
  const ex = exampleRow(variant);
  // the group (column D) is whatever the course's first group was at
  // download time, so it isn't compared
  const expected = [ex.name, ex.grade, ex.age, null, ex.planTemplate, ex.rangeFrom, ex.rangeTo, ex.scattered, ex.partialSurah, ex.partialFrom, ex.partialTo];
  return expected.every((v, i) => v === null || cells[i] === String(v));
}
