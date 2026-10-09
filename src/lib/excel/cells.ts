import "server-only";
import type ExcelJS from "exceljs";
import { AYAH_COUNT, SURAHS } from "@/lib/quran-data";

// Reading cells of an uploaded workbook, shared by the bulk student import
// (students/import-parse.ts) and «التسميع بدون إنترنت» (offline-sheet), so
// both read text, numbers and surah names the same way.

/** keepLines: keep line breaks (multi-line extra-info notes); otherwise all whitespace folds to one space. */
export function cellText(value: ExcelJS.CellValue, keepLines = false): string {
  if (value == null) return "";
  if (typeof value === "string") return keepLines ? value.replace(/\r\n?/g, "\n").trim() : value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    if ("richText" in value) return cellText(value.richText.map((t) => t.text).join(""), keepLines);
    if ("result" in value) return cellText((value.result ?? null) as ExcelJS.CellValue, keepLines);
    if ("text" in value) return cellText(value.text as ExcelJS.CellValue, keepLines);
  }
  return "";
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII. */
export function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

export function toInteger(text: string): number | null {
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
export function parseSurah(text: string, column: string, errors: string[]): number | null {
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
