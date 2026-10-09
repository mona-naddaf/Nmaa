"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { getOfflineAccess } from "@/lib/offline-sheet/access";
import { parseOfflineSheet } from "@/lib/offline-sheet/parse";
import {
  MissingReasonError,
  missingReasons,
  saveSheet,
  validateSheet,
  type PreviewRow,
  type SaveSummary,
} from "@/lib/offline-sheet/validate";

// «التسميع بدون إنترنت» upload, in two steps. Both take the file itself and
// check everything again on the server (getOfflineAccess, validateSheet):
// step 1 only reports, step 2 saves. Nothing is kept between them.

export type PreviewResult =
  | { error: string }
  | { date: string; rows: PreviewRow[]; emptyRows: number; notice?: string };

export type ConfirmResult = PreviewResult | { saved: SaveSummary; date: string };

// kept under the 1MB Server Action body limit, with room for multipart overhead
const MAX_FILE_BYTES = 900 * 1024;

async function readUpload(formData: FormData) {
  const session = await requireSession();
  const access = await getOfflineAccess(session);
  if (!access) return { error: "ليست لديك صلاحية «التسميع بدون إنترنت» في هذه الدورة" } as const;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "يُرجى اختيار ملف Excel" } as const;
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "يُرجى رفع ملف بصيغة ‎.xlsx‎" } as const;
  if (file.size > MAX_FILE_BYTES) return { error: "حجم الملف كبير جدًا" } as const;

  const sheet = await parseOfflineSheet(await file.arrayBuffer());
  if ("error" in sheet) return { error: sheet.error } as const;
  return { session, access, sheet } as const;
}

function readReasons(formData: FormData): Record<string, string> {
  try {
    const parsed = JSON.parse(String(formData.get("reasons") ?? "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string").map(([k, v]) => [k, v.slice(0, 500)]),
    );
  } catch {
    return {};
  }
}

export async function previewOfflineSheetAction(_prev: unknown, formData: FormData): Promise<PreviewResult> {
  const upload = await readUpload(formData);
  if ("error" in upload) return { error: upload.error! };
  const check = await validateSheet(upload.access, upload.sheet);
  if ("fatal" in check) return { error: check.fatal };
  return check;
}

export async function confirmOfflineSheetAction(formData: FormData): Promise<ConfirmResult> {
  const upload = await readUpload(formData);
  if ("error" in upload) return { error: upload.error! };
  const reasons = readReasons(formData);
  const check = await validateSheet(upload.access, upload.sheet, reasons);
  if ("fatal" in check) return { error: check.fatal };

  if (missingReasons(check.rows, reasons).length > 0) {
    return { ...check, notice: "يُرجى كتابة سبب لكل تسجيل يحتاج سببًا قبل الحفظ." };
  }

  const teacherId = await resolveTeacherId(upload.session);
  try {
    const saved = await saveSheet(check, reasons, teacherId);
    revalidatePath("/students", "layout");
    return { saved, date: check.date };
  } catch (e) {
    if (!(e instanceof MissingReasonError)) throw e;
    // something was recorded on the site since the preview: show it again
    const again = await validateSheet(upload.access, upload.sheet, reasons);
    if ("fatal" in again) return { error: again.fatal };
    return { ...again, notice: "تغيّرت بيانات بعض الطلاب منذ المعاينة، فلم يُحفظ شيء. يُرجى مراجعة المعاينة من جديد ثم الحفظ." };
  }
}
