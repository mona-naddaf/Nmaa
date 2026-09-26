import "server-only";
import ExcelJS from "exceljs";
import { SURAHS } from "@/lib/quran-data";
import { PLAN_TEMPLATES, PLAN_TEMPLATE_LABEL } from "@/lib/students/new-student";
import { imperative, pickByGroup, studentNounDef, studentsNounDef, type PersonGender } from "@/lib/text/gender";

// The bulk-import Excel template (see students/import). Built from scratch on
// every download so the group dropdown always lists the course's current
// groups. Mirrors the hand-designed prototypes (design/namaa-import-template-
// {girls,boys}.xlsx) cell for cell: same sheets, rows, widths, colours and
// dropdowns — only the wording follows the chosen variant (student words)
// and the supervisor's own gender (instructions addressed to them).

export type TemplateVariant = "girls" | "boys";

export const HEADER_ROW = 4;
export const EXAMPLE_ROW = 5;
export const FIRST_DATA_ROW = 5;
const FIRST_DROPDOWN_ROW = 6;
const LAST_DROPDOWN_ROW = 205;

export const MAIN_SHEET_NAMES: Record<TemplateVariant, string> = { girls: "الطالبات", boys: "الطلاب" };
export const SURAH_SHEET_NAME = "قائمة السور";
const LISTS_SHEET_NAME = "قوائم";

const variantGender = (variant: TemplateVariant) => (variant === "girls" ? "GIRLS" : "BOYS");

/** Column A's header is gendered; the rest (B–K) are fixed. */
export const nameHeader = (variant: TemplateVariant) => `اسم ${studentNounDef(variantGender(variant))}`;
export const FIXED_HEADERS = [
  "الصف",
  "العمر",
  "اسم المجموعة",
  "نوع خطة الحفظ",
  "من سورة (حفظ سابق)",
  "إلى سورة (حفظ سابق)",
  "سور متفرقة (حفظ سابق)",
  "سورة جزئية (حفظ سابق)",
  "من آية (السورة الجزئية)",
  "إلى آية (السورة الجزئية)",
];

/** "6 - الأنعام" — the form surahs take in the dropdowns. */
export const surahLabel = (n: number, name: string) => `${n} - ${name}`;

/** The example row's content, minus the group (which is a live group name). */
export function exampleRow(variant: TemplateVariant) {
  return {
    name: pickByGroup(variantGender(variant), { m: "عمر أحمد", f: "سارة أحمد" }),
    grade: "الخامس",
    age: 10,
    planTemplate: PLAN_TEMPLATE_LABEL.MUSHAF_ORDER,
    rangeFrom: 1,
    rangeTo: 5,
    scattered: "8, 12",
    partialSurah: 6,
    partialFrom: 1,
    partialTo: 45,
  };
}

const COLUMN_WIDTHS = [20, 10, 8, 18, 22, 20, 20, 22, 20, 16, 16];

const BORDER_COLOR = { argb: "00D9D2C2" };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: BORDER_COLOR },
  left: { style: "thin", color: BORDER_COLOR },
  bottom: { style: "thin", color: BORDER_COLOR },
  right: { style: "thin", color: BORDER_COLOR },
};
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "004A6B52" } };
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00FFF7DC" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "Arial", bold: true, color: { argb: "00FFFFFF" }, size: 11 };

export async function buildImportTemplate({
  variant,
  groupNames,
  exampleGroupName,
  supervisorGender,
}: {
  variant: TemplateVariant;
  groupNames: string[];
  exampleGroupName: string;
  supervisorGender: PersonGender;
}): Promise<Buffer> {
  const g = variantGender(variant);
  const you = (forms: { m: string; f: string }) => imperative(supervisorGender, forms);
  const eachStudent = pickByGroup(g, { m: "كل طالب بسطر لحاله", f: "كل طالبة بسطر لحالها" });
  const hasPrior = pickByGroup(g, { m: "بالطالب حفظ سابق قبل ما ينضم", f: "بالطالبة حفظ سابق قبل ما تنضم" });

  const wb = new ExcelJS.Workbook();
  wb.creator = "نماء";

  // ---------- main sheet ----------
  const ws = wb.addWorksheet(MAIN_SHEET_NAMES[variant], {
    views: [{ state: "frozen", ySplit: HEADER_ROW, topLeftCell: `A${FIRST_DATA_ROW}`, activeCell: "A1", rightToLeft: true }],
  });
  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  const title = ws.getCell("A1");
  title.value = `قالب استيراد ${studentsNounDef(g)} — نماء 🌱`;
  title.font = { name: "Arial", bold: true, color: { argb: "003F6650" }, size: 14 };
  title.alignment = { horizontal: "center" };
  ws.mergeCells("A1:K1");

  const notes = [
    `${you({ m: "عبّ", f: "عبّي" })} بيانات ${eachStudent} بدءًا من السطر ${FIRST_DATA_ROW}. ${you({ m: "لا تحذف", f: "لا تحذفي" })} رأس الأعمدة (السطر ${HEADER_ROW}). الأعمدة الصفراء فيها قوائم اختيار جاهزة.`,
    `الأعمدة 6-11 اختيارية: ${you({ m: "عبّها", f: "عبّيها" })} بس لو ${hasPrior}. لو ما في حفظ سابق، ${you({ m: "اتركهم", f: "اتركيهم" })} فاضيين.`,
  ];
  notes.forEach((text, i) => {
    const row = ws.getRow(2 + i);
    row.height = i === 0 ? 30 : 20;
    const cell = row.getCell(1);
    cell.value = text;
    cell.font = { name: "Arial", italic: true, color: { argb: "006C685D" }, size: 10 };
    cell.alignment = { horizontal: "right", wrapText: true };
    ws.mergeCells(2 + i, 1, 2 + i, 11);
  });

  const header = ws.getRow(HEADER_ROW);
  header.height = 40;
  [nameHeader(variant), ...FIXED_HEADERS].forEach((text, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const ex = exampleRow(variant);
  const exampleCells = ws.getRow(EXAMPLE_ROW);
  [ex.name, ex.grade, ex.age, exampleGroupName, ex.planTemplate, ex.rangeFrom, ex.rangeTo, ex.scattered, ex.partialSurah, ex.partialFrom, ex.partialTo].forEach(
    (value, i) => {
      const cell = exampleCells.getCell(i + 1);
      cell.value = value;
      cell.font = { name: "Arial", italic: true, color: { argb: "009C9484" } };
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: "center" };
    },
  );
  exampleCells.getCell(1).note = {
    texts: [{ text: `سطر مثال بس — ${you({ m: "احذفه أو اكتب", f: "احذفيه أو اكتبي" })} فوقه ببيانات حقيقية` }],
  };

  for (let r = FIRST_DROPDOWN_ROW; r <= LAST_DROPDOWN_ROW; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.fill = INPUT_FILL;
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: "center" };
    }
    // text format, so a list like "8,12" isn't read as the number 812
    row.getCell(8).numFmt = "@";
  }

  // Dropdowns are suggestions only (error alerts off, as in the prototype):
  // the upload re-validates every cell anyway.
  const rows = (col: string) => `${col}${FIRST_DROPDOWN_ROW}:${col}${LAST_DROPDOWN_ROW}`;
  const list = (formula: string): ExcelJS.DataValidation => ({
    type: "list",
    allowBlank: true,
    showErrorMessage: false,
    formulae: [formula],
  });
  const whole = (min: number, max: number): ExcelJS.DataValidation => ({
    type: "whole",
    operator: "between",
    allowBlank: true,
    showErrorMessage: false,
    formulae: [min, max],
  });
  // range-level validations exist at runtime but aren't in exceljs's typings
  const validations = (ws as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } })
    .dataValidations;
  validations.add(rows("D"), list(`${LISTS_SHEET_NAME}!$B$2:$B$${1 + Math.max(1, groupNames.length)}`));
  validations.add(rows("E"), list(`${LISTS_SHEET_NAME}!$A$2:$A$${1 + PLAN_TEMPLATES.length}`));
  for (const col of ["F", "G", "I"]) {
    validations.add(rows(col), list(`'${SURAH_SHEET_NAME}'!$C$2:$C$${1 + SURAHS.length}`));
  }
  validations.add(`J${FIRST_DROPDOWN_ROW}:K${LAST_DROPDOWN_ROW}`, whole(1, 286));
  validations.add(rows("C"), whole(3, 25));

  // ---------- surah reference sheet ----------
  const surahSheet = wb.addWorksheet(SURAH_SHEET_NAME, { views: [{ rightToLeft: true }] });
  surahSheet.columns = [{ width: 12 }, { width: 20 }, { width: 20 }];
  const surahHeader = surahSheet.addRow(["رقم السورة", "اسم السورة", "السورة (للاختيار)"]);
  surahHeader.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center" };
  });
  for (const s of SURAHS) surahSheet.addRow([s.number, s.name, surahLabel(s.number, s.name)]);

  // ---------- hidden dropdown sources ----------
  const lists = wb.addWorksheet(LISTS_SHEET_NAME, { state: "hidden", views: [{ rightToLeft: true }] });
  lists.columns = [{ width: 24 }, { width: 40 }];
  lists.getCell("A1").value = "نوع خطة الحفظ";
  lists.getCell("B1").value = "اسم المجموعة";
  PLAN_TEMPLATES.forEach((t, i) => (lists.getCell(2 + i, 1).value = PLAN_TEMPLATE_LABEL[t]));
  groupNames.forEach((name, i) => (lists.getCell(2 + i, 2).value = name));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
