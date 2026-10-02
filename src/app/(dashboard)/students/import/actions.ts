"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { matchImportRows, matchInfoColumns, parseImportWorkbook, type SkippedRow } from "@/lib/students/import-parse";
import { getCourseInfoFields } from "@/lib/students/extra-info";
import { studentCreateData } from "@/lib/students/new-student";

export type ImportState =
  | null
  | { error: string }
  | { created: number; skipped: SkippedRow[]; exampleSkipped: boolean };

// kept under the 1MB Server Action body limit, with room for multipart overhead
const MAX_FILE_BYTES = 900 * 1024;

// Bulk import is supervisor-only regardless of the course's add-students
// permission: it's a higher-risk bulk action than adding one student.
export async function importStudentsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const session = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "يُرجى اختيار ملف Excel" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "يُرجى رفع ملف بصيغة ‎.xlsx‎" };
  if (file.size > MAX_FILE_BYTES) return { error: "حجم الملف كبير جدًا" };

  const parsed = await parseImportWorkbook(await file.arrayBuffer());
  if ("error" in parsed) return { error: parsed.error };

  const [groups, existing, course, infoFields] = await Promise.all([
    prisma.group.findMany({ where: { courseId: session.courseId }, select: { id: true, name: true, gender: true } }),
    prisma.student.findMany({ where: { courseId: session.courseId }, select: { name: true } }),
    prisma.course.findUniqueOrThrow({ where: { id: session.courseId }, select: { studentInfoEnabled: true } }),
    getCourseInfoFields(session.courseId),
  ]);
  // extra-info columns: an out-of-date template refuses the whole file
  const info = matchInfoColumns(parsed.infoHeaders, infoFields, course.studentInfoEnabled);
  if ("error" in info) return { error: info.error };
  const { toCreate, skipped } = matchImportRows(parsed.rows, groups, existing.map((s) => s.name), info.columns);

  if (toCreate.length > 0) {
    const teacherId = await resolveTeacherId(session);
    await prisma.$transaction(
      async (tx) => {
        for (const { groupId, student, info } of toCreate) {
          await tx.student.create({
            data: {
              ...studentCreateData(student, { courseId: session.courseId, groupId, teacherId }),
              infoValues: { createMany: { data: info.map((v) => ({ ...v, updatedBy: "ADMIN" as const })) } },
            },
          });
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    revalidatePath("/students");
  }

  return { created: toCreate.length, skipped, exampleSkipped: parsed.exampleSkipped };
}
