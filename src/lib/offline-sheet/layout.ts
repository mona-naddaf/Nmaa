import type { SessionType } from "@/lib/recitation/logic";
import type { Quality } from "@/lib/recitation/record";

// The layout of a «التسميع بدون إنترنت» workbook, shared by the builder
// (template.ts) and the reader (parse.ts). One sheet per group, then two
// hidden sheets: the dropdown lists and the sheet → group map with a marker
// that tells this file apart from any other Excel file.

export const SHEET_MARKER = "namaa-offline-sheet-v1";
export const META_SHEET_NAME = "بيانات النظام";
export const LISTS_SHEET_NAME = "قوائم";

// the date: editable on the first group sheet, a formula on the others
export const DATE_ROW = 2;
export const DATE_LABEL_COL = 2;
export const DATE_COL = 3;

export const BLOCK_TITLE_ROW = 4;
export const HEADER_ROW = 5;
export const FIRST_STUDENT_ROW = 6;

export const ID_COL = 1; // hidden, locked: the student's id
export const NAME_COL = 2; // locked
export const ATTENDANCE_COL = 3;
export const BLOCK_TYPES: SessionType[] = ["NEW", "REVIEW", "LINK"];
export const BLOCK_START: Record<SessionType, number> = { NEW: 4, REVIEW: 9, LINK: 14 };
export const BLOCK_WIDTH = 5;
// offsets inside a block
export const FROM_SURAH = 0;
export const FROM_AYAH = 1;
export const TO_SURAH = 2;
export const TO_AYAH = 3;
export const QUALITY = 4;
export const POINTS_COL = 19;
export const LAST_COL = POINTS_COL;

export const BLOCK_HEADERS = ["من سورة", "من آية", "إلى سورة (اختياري)", "إلى آية", "التقييم"];
export const BLOCK_TITLE: Record<SessionType, string> = { NEW: "حفظ جديد", REVIEW: "مراجعة", LINK: "ربط" };

// exactly the site's values (the recitation form's «مستوى التسميع»)
export const QUALITY_LABEL: Record<Quality, string> = {
  EXCELLENT: "متقن (بدون أخطاء)",
  GOOD: "جيد",
  NEEDS_REPEAT: "يحتاج إعادة",
};

export const MAX_POINTS = 20;
export const POINTS_NOTE = "تسميع من ملف Excel";
