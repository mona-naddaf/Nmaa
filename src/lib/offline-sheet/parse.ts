import "server-only";
import ExcelJS from "exceljs";
import type { SessionType } from "@/lib/recitation/logic";
import { cellText } from "@/lib/excel/cells";
import {
  ATTENDANCE_COL,
  BLOCK_START,
  BLOCK_TYPES,
  DATE_COL,
  DATE_ROW,
  FIRST_STUDENT_ROW,
  FROM_AYAH,
  FROM_SURAH,
  ID_COL,
  META_SHEET_NAME,
  NAME_COL,
  POINTS_COL,
  QUALITY,
  SHEET_MARKER,
  TO_AYAH,
  TO_SURAH,
} from "./layout";
import { readSheetDate } from "./dates";

// Reads an uploaded «التسميع بدون إنترنت» workbook into raw rows: cell texts
// only. Every rule (who, which students, surahs, ayat, ratings, the date's
// range) is applied afterwards by validate.ts, on the server, on every
// upload step.

export interface RawBlock {
  fromSurah: string;
  fromAyah: string;
  toSurah: string;
  toAyah: string;
  quality: string;
}

export interface RawRow {
  sheet: string;
  row: number;
  studentId: string;
  name: string;
  attendance: string;
  blocks: Record<SessionType, RawBlock>;
  points: string;
}

export type RawSheet = { error: string } | { date: Date | null; dateText: string; rows: RawRow[] };

const NOT_OURS = "هذا الملف ليس ملف «التسميع بدون إنترنت». يُرجى تنزيل الملف من الموقع وتعبئته ثم رفعه.";

export async function parseOfflineSheet(data: ArrayBuffer): Promise<RawSheet> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return { error: "تعذّرت قراءة الملف. يُرجى رفع ملف Excel ‎(.xlsx)‎ كما نُزِّل من الموقع." };
  }

  const meta = wb.getWorksheet(META_SHEET_NAME);
  if (!meta || cellText(meta.getCell("A1").value) !== SHEET_MARKER) return { error: NOT_OURS };
  const sheetNames: string[] = [];
  for (let r = 2; cellText(meta.getCell(r, 1).value); r++) sheetNames.push(cellText(meta.getCell(r, 1).value));
  const sheets = sheetNames.map((n) => wb.getWorksheet(n));
  if (sheets.length === 0 || sheets.some((s) => !s)) {
    return { error: "إحدى أوراق المجموعات حُذفت أو غُيِّر اسمها. يُرجى تنزيل الملف من جديد." };
  }

  // the date lives on the first group sheet
  const raw = sheets[0]!.getCell(DATE_ROW, DATE_COL).value;
  const value = raw && typeof raw === "object" && "result" in raw ? raw.result : raw;
  const date = readSheetDate(value);
  const dateText = value instanceof Date ? "" : cellText(value as ExcelJS.CellValue);

  const rows: RawRow[] = [];
  sheets.forEach((ws, si) => {
    for (let r = FIRST_STUDENT_ROW; r <= ws!.rowCount; r++) {
      const row = ws!.getRow(r);
      const text = (col: number) => cellText(row.getCell(col).value);
      const blocks = Object.fromEntries(
        BLOCK_TYPES.map((type) => {
          const s = BLOCK_START[type];
          return [
            type,
            {
              fromSurah: text(s + FROM_SURAH),
              fromAyah: text(s + FROM_AYAH),
              toSurah: text(s + TO_SURAH),
              toAyah: text(s + TO_AYAH),
              quality: text(s + QUALITY),
            },
          ];
        }),
      ) as Record<SessionType, RawBlock>;
      const parsed: RawRow = {
        sheet: sheetNames[si],
        row: r,
        studentId: text(ID_COL),
        name: text(NAME_COL),
        attendance: text(ATTENDANCE_COL),
        blocks,
        points: text(POINTS_COL),
      };
      const anyInput =
        parsed.attendance || parsed.points || BLOCK_TYPES.some((t) => Object.values(blocks[t]).some(Boolean));
      // the «no students in this group» note and fully blank rows
      if (!parsed.studentId && !anyInput) continue;
      rows.push(parsed);
    }
  });

  return { date, dateText, rows };
}
