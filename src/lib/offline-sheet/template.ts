import "server-only";
import ExcelJS from "exceljs";
import { SURAHS, SURAH_NAME } from "@/lib/quran-data";
import { surahLabel } from "@/lib/students/import-template";
import {
  absentWord,
  imperative,
  presentWord,
  studentNoun,
  studentNounDef,
  studentsNounDef,
  type GroupGender,
  type PersonGender,
} from "@/lib/text/gender";
import {
  ATTENDANCE_COL,
  BLOCK_HEADERS,
  BLOCK_START,
  BLOCK_TITLE,
  BLOCK_TITLE_ROW,
  BLOCK_TYPES,
  BLOCK_WIDTH,
  DATE_COL,
  DATE_LABEL_COL,
  DATE_ROW,
  FIRST_STUDENT_ROW,
  FROM_AYAH,
  FROM_SURAH,
  HEADER_ROW,
  ID_COL,
  LAST_COL,
  LISTS_SHEET_NAME,
  MAX_POINTS,
  META_SHEET_NAME,
  NAME_COL,
  POINTS_COL,
  QUALITY,
  QUALITY_LABEL,
  SHEET_MARKER,
  TO_AYAH,
} from "./layout";

// Builds the «التسميع بدون إنترنت» workbook (layout.ts): one sheet per group
// with its active students, each row pre-filled with where her new
// memorization continues from. Same look as the import template.

export interface SheetGroup {
  id: string;
  name: string;
  gender: GroupGender;
  students: { id: string; name: string; next: { surahNumber: number; fromAyah: number } | null }[];
}

const BORDER_COLOR = { argb: "00D9D2C2" };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: BORDER_COLOR },
  left: { style: "thin", color: BORDER_COLOR },
  bottom: { style: "thin", color: BORDER_COLOR },
  right: { style: "thin", color: BORDER_COLOR },
};
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "004A6B52" } };
const BLOCK_FILLS: ExcelJS.Fill[] = ["00A85C36", "008F5A50", "006C685D"].map((argb) => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
}));
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00FFF7DC" } };
const LOCKED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00F3EFE6" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "Arial", bold: true, color: { argb: "00FFFFFF" }, size: 11 };

/** A valid, unique Excel sheet name for a group (≤31 chars, none of : \ / ? * [ ]). */
function sheetNameFor(name: string, taken: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "مجموعة";
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base.slice(0, 26)} ${i}`;
  taken.add(candidate);
  return candidate;
}

export async function buildOfflineSheet({
  groups,
  dateISO,
  viewerGender,
}: {
  groups: SheetGroup[];
  dateISO: string;
  viewerGender: PersonGender;
}): Promise<Buffer> {
  const you = (forms: { m: string; f: string }) => imperative(viewerGender, forms);
  const wb = new ExcelJS.Workbook();
  wb.creator = "على مُكث";
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  const names = new Set<string>([META_SHEET_NAME, LISTS_SHEET_NAME]);
  const sheetNames = groups.map((g) => sheetNameFor(g.name, names));
  const firstSheet = sheetNames[0];
  const lastRow = (n: number) => FIRST_STUDENT_ROW + Math.max(n, 1) - 1;

  groups.forEach((group, gi) => {
    const g = group.gender;
    const ws = wb.addWorksheet(sheetNames[gi], {
      views: [{ state: "frozen", ySplit: HEADER_ROW, xSplit: NAME_COL, topLeftCell: `C${FIRST_STUDENT_ROW}`, rightToLeft: true }],
    });
    ws.columns = [
      { width: 4 },
      { width: 24 },
      { width: 11 },
      ...BLOCK_TYPES.flatMap(() => [{ width: 18 }, { width: 8 }, { width: 18 }, { width: 8 }, { width: 17 }]),
      { width: 9 },
    ];
    ws.getColumn(ID_COL).hidden = true;

    const title = ws.getCell(1, NAME_COL);
    title.value = `تسميع ${group.name} — على مُكث`;
    title.font = { name: "Arial", bold: true, color: { argb: "003F6650" }, size: 14 };
    title.alignment = { horizontal: "right" };
    ws.mergeCells(1, NAME_COL, 1, LAST_COL);

    // the date: one per file, written on the first sheet
    const label = ws.getCell(DATE_ROW, DATE_LABEL_COL);
    label.value = "تاريخ اليوم:";
    label.font = { name: "Arial", bold: true };
    label.alignment = { horizontal: "left" };
    const dateCell = ws.getCell(DATE_ROW, DATE_COL);
    if (gi === 0) {
      dateCell.value = date;
      dateCell.fill = INPUT_FILL;
      dateCell.protection = { locked: false };
    } else {
      const ref = `'${firstSheet.replace(/'/g, "''")}'!${ws.getColumn(DATE_COL).letter}${DATE_ROW}`;
      dateCell.value = { formula: ref, result: date };
      dateCell.fill = LOCKED_FILL;
    }
    dateCell.numFmt = "yyyy-mm-dd";
    dateCell.font = { name: "Arial", bold: true, size: 12 };
    dateCell.border = THIN_BORDER;
    dateCell.alignment = { horizontal: "center" };
    const dateNote = ws.getCell(DATE_ROW, DATE_COL + 1);
    dateNote.value =
      gi === 0
        ? `${you({ m: "اكتب", f: "اكتبي" })} تاريخ اليوم الذي تُسجَّل بياناته (سنة-شهر-يوم). تاريخ واحد للملف كله.`
        : `التاريخ يُعدَّل من الورقة الأولى «${firstSheet}».`;
    dateNote.font = { name: "Arial", italic: true, color: { argb: "006C685D" }, size: 10 };
    ws.mergeCells(DATE_ROW, DATE_COL + 1, DATE_ROW, LAST_COL);

    const notes = ws.getCell(3, NAME_COL);
    notes.value =
      `${you({ m: "اترك", f: "اتركي" })} أي قسم فارغًا إذا لم يكن فيه تسميع. «إلى سورة» اختيارية: إن تُركت فارغة فالتسميع في السورة نفسها. ` +
      `حقلا «من» في الحفظ الجديد معبَّآن مسبقًا بالموضع التالي لكل ${studentNoun(g)}، ولا يُحسبان تسميعًا ما لم تُعبَّأ «إلى آية» والتقييم. ` +
      `«النقاط»: عدد النقاط الإضافية لهذا اليوم (من 0 إلى ${MAX_POINTS}).`;
    notes.font = { name: "Arial", italic: true, color: { argb: "006C685D" }, size: 10 };
    notes.alignment = { horizontal: "right", wrapText: true, vertical: "top" };
    ws.getRow(3).height = 32;
    ws.mergeCells(3, NAME_COL, 3, LAST_COL);

    // block titles over each recitation block
    BLOCK_TYPES.forEach((type, bi) => {
      const start = BLOCK_START[type];
      const cell = ws.getCell(BLOCK_TITLE_ROW, start);
      cell.value = BLOCK_TITLE[type];
      cell.font = HEADER_FONT;
      cell.fill = BLOCK_FILLS[bi];
      cell.alignment = { horizontal: "center" };
      ws.mergeCells(BLOCK_TITLE_ROW, start, BLOCK_TITLE_ROW, start + BLOCK_WIDTH - 1);
    });

    const header = ws.getRow(HEADER_ROW);
    header.height = 32;
    const headers: [number, string, ExcelJS.Fill][] = [
      [ID_COL, "المعرّف", HEADER_FILL],
      [NAME_COL, `اسم ${studentNounDef(g)}`, HEADER_FILL],
      [ATTENDANCE_COL, "الحضور", HEADER_FILL],
      ...BLOCK_TYPES.flatMap((type, bi) =>
        BLOCK_HEADERS.map((h, i) => [BLOCK_START[type] + i, h, BLOCK_FILLS[bi]] as [number, string, ExcelJS.Fill]),
      ),
      [POINTS_COL, "النقاط", HEADER_FILL],
    ];
    for (const [col, text, fill] of headers) {
      const cell = header.getCell(col);
      cell.value = text;
      cell.font = HEADER_FONT;
      cell.fill = fill;
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    group.students.forEach((s, i) => {
      const row = ws.getRow(FIRST_STUDENT_ROW + i);
      row.getCell(ID_COL).value = s.id;
      const name = row.getCell(NAME_COL);
      name.value = s.name;
      name.font = { name: "Arial", bold: true };
      name.fill = LOCKED_FILL;
      name.border = THIN_BORDER;
      name.alignment = { horizontal: "right" };
      for (let c = ATTENDANCE_COL; c <= LAST_COL; c++) {
        const cell = row.getCell(c);
        cell.fill = INPUT_FILL;
        cell.border = THIN_BORDER;
        cell.alignment = { horizontal: "center" };
        cell.protection = { locked: false };
      }
      if (s.next) {
        row.getCell(BLOCK_START.NEW + FROM_SURAH).value = surahLabel(s.next.surahNumber, SURAH_NAME[s.next.surahNumber]);
        row.getCell(BLOCK_START.NEW + FROM_AYAH).value = s.next.fromAyah;
      }
    });

    // dropdowns: suggestions only (no error alerts, as in the import
    // template) — the upload re-validates every cell anyway
    const last = lastRow(group.students.length);
    const range = (col: number) => `${ws.getColumn(col).letter}${FIRST_STUDENT_ROW}:${ws.getColumn(col).letter}${last}`;
    const list = (formula: string): ExcelJS.DataValidation => ({ type: "list", allowBlank: true, showErrorMessage: false, formulae: [formula] });
    const whole = (min: number, max: number): ExcelJS.DataValidation => ({
      type: "whole",
      operator: "between",
      allowBlank: true,
      showErrorMessage: false,
      formulae: [min, max],
    });
    // range-level validations exist at runtime but aren't in exceljs's typings
    const validations = (ws as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations;
    validations.add(range(ATTENDANCE_COL), list(`"${presentWord(g)},${absentWord(g)}"`));
    for (const type of BLOCK_TYPES) {
      const start = BLOCK_START[type];
      for (const col of [start + FROM_SURAH, start + 2]) validations.add(range(col), list(`${LISTS_SHEET_NAME}!$A$1:$A$${SURAHS.length}`));
      for (const col of [start + FROM_AYAH, start + TO_AYAH]) validations.add(range(col), whole(1, 286));
      validations.add(range(start + QUALITY), list(`"${Object.values(QUALITY_LABEL).join(",")}"`));
    }
    validations.add(range(POINTS_COL), whole(0, MAX_POINTS));

    if (group.students.length === 0) {
      const empty = ws.getCell(FIRST_STUDENT_ROW, NAME_COL);
      empty.value = `لا يوجد ${studentsNounDef(g)} في هذه المجموعة`;
      empty.font = { name: "Arial", italic: true, color: { argb: "009C9484" } };
    }
  });

  // ---------- hidden sheets ----------
  const lists = wb.addWorksheet(LISTS_SHEET_NAME, { state: "hidden" });
  SURAHS.forEach((s, i) => (lists.getCell(i + 1, 1).value = surahLabel(s.number, s.name)));

  const meta = wb.addWorksheet(META_SHEET_NAME, { state: "veryHidden" });
  meta.getCell("A1").value = SHEET_MARKER;
  groups.forEach((g, i) => {
    meta.getCell(i + 2, 1).value = sheetNames[i];
    meta.getCell(i + 2, 2).value = g.id;
  });

  // names, ids and headers are locked so they aren't changed by accident
  // (no password: it's a guard, not security — the upload matches by id
  // and checks every one on the server)
  for (const name of sheetNames) {
    await wb.getWorksheet(name)!.protect("", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatColumns: true,
      formatRows: true,
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
