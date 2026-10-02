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
// and the supervisor's own gender (instructions addressed to them). When the
// course collects extra student info, one column per enabled field follows
// column K (required ones marked «*»); import-parse.ts matches them by name.

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

/** The fixed columns A–K; extra-info columns start right after. */
export const FIXED_COLUMN_COUNT = 1 + FIXED_HEADERS.length;

/** An extra-info column's header: the field name, plus « *» when required. */
export const infoColumnHeader = (label: string, required: boolean) => (required ? `${label} *` : label);

export interface InfoColumn {
  // already in the variant's wording (e.g. «رقم هاتف الطالبة»)
  label: string;
  required: boolean;
  multiline: boolean;
}

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
const INFO_COLUMN_WIDTH = 20;
const INFO_MULTILINE_WIDTH = 32;
const INFO_HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00A85C36" } };

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
  infoColumns = [],
}: {
  variant: TemplateVariant;
  groupNames: string[];
  exampleGroupName: string;
  supervisorGender: PersonGender;
  infoColumns?: InfoColumn[];
}): Promise<Buffer> {
  const g = variantGender(variant);
  const you = (forms: { m: string; f: string }) => imperative(supervisorGender, forms);
  const eachStudent = pickByGroup(g, { m: "كل طالب في سطر مستقل", f: "كل طالبة في سطر مستقل" });
  const hasPrior = pickByGroup(g, {
    m: "إذا كان للطالب حفظ سابق قبل انضمامه",
    f: "إذا كان للطالبة حفظ سابق قبل انضمامها",
  });
  const lastCol = FIXED_COLUMN_COUNT + infoColumns.length;

  const wb = new ExcelJS.Workbook();
  wb.creator = "على مُكث";

  // ---------- main sheet ----------
  const ws = wb.addWorksheet(MAIN_SHEET_NAMES[variant], {
    views: [{ state: "frozen", ySplit: HEADER_ROW, topLeftCell: `A${FIRST_DATA_ROW}`, activeCell: "A1", rightToLeft: true }],
  });
  ws.columns = [
    ...COLUMN_WIDTHS.map((width) => ({ width })),
    ...infoColumns.map((c) => ({ width: c.multiline ? INFO_MULTILINE_WIDTH : INFO_COLUMN_WIDTH })),
  ];

  const title = ws.getCell("A1");
  title.value = `قالب استيراد ${studentsNounDef(g)} — على مُكث`;
  title.font = { name: "Arial", bold: true, color: { argb: "003F6650" }, size: 14 };
  title.alignment = { horizontal: "center" };
  ws.mergeCells(1, 1, 1, lastCol);

  const notes = [
    `${you({ m: "أدخِل", f: "أدخِلي" })} بيانات ${eachStudent} بدءًا من السطر ${FIRST_DATA_ROW}، ${you({ m: "ولا تحذف", f: "ولا تحذفي" })} سطر رؤوس الأعمدة (السطر ${HEADER_ROW}). وفي الأعمدة الصفراء قوائم اختيار جاهزة.`,
    // only two note rows fit above the header row
    `الأعمدة 6–11 اختيارية، وتُعبَّأ فقط ${hasPrior}، وإلا فتُترك فارغة.` +
      (infoColumns.length > 0
        ? ` والأعمدة من ${ws.getColumn(FIXED_COLUMN_COUNT + 1).letter} فما بعدها للمعلومات الإضافية: المعلَّم منها بـ«*» إلزامي، والبقية اختيارية.`
        : ""),
  ];
  notes.forEach((text, i) => {
    const row = ws.getRow(2 + i);
    row.height = i === 0 || infoColumns.length > 0 ? 30 : 20;
    const cell = row.getCell(1);
    cell.value = text;
    cell.font = { name: "Arial", italic: true, color: { argb: "006C685D" }, size: 10 };
    cell.alignment = { horizontal: "right", wrapText: true };
    ws.mergeCells(2 + i, 1, 2 + i, lastCol);
  });

  const header = ws.getRow(HEADER_ROW);
  header.height = 40;
  [nameHeader(variant), ...FIXED_HEADERS, ...infoColumns.map((c) => infoColumnHeader(c.label, c.required))].forEach((text, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text;
    cell.font = HEADER_FONT;
    cell.fill = i < FIXED_COLUMN_COUNT ? HEADER_FILL : INFO_HEADER_FILL;
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
    texts: [{ text: `سطر للمثال فقط؛ ${you({ m: "احذفه أو اكتب", f: "احذفيه أو اكتبي" })} فوقه بيانات حقيقية` }],
  };

  for (let r = FIRST_DROPDOWN_ROW; r <= LAST_DROPDOWN_ROW; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.fill = INPUT_FILL;
      cell.border = THIN_BORDER;
      cell.alignment = c > FIXED_COLUMN_COUNT ? { horizontal: "right", wrapText: true } : { horizontal: "center" };
      // extra info is always text: keeps a phone's leading 0 and stops
      // Excel turning it into a number or a date
      if (c > FIXED_COLUMN_COUNT) cell.numFmt = "@";
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
