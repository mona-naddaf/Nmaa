"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { matchImportRows, matchInfoColumns, parseImportWorkbook, type SkippedRow } from "@/lib/students/import-parse";
import { getImportAccess } from "@/lib/students/import-access";
import { getCourseInfoFields } from "@/lib/students/extra-info";
import { studentCreateData } from "@/lib/students/new-student";
import { NEUTRAL_GROUP_GENDER, studentsNoun } from "@/lib/text/gender";

export type ImportState =
  | null
  | { error: string }
  | { created: number; skipped: SkippedRow[]; exampleSkipped: boolean };

// kept under the 1MB Server Action body limit, with room for multipart overhead
const MAX_FILE_BYTES = 900 * 1024;

// Same permission as adding one student (getImportAccess): a teacher imports
// only into her groups and fills only the extra info her add form shows.
export async function importStudentsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const session = await requireSession();
  const access = await getImportAccess(session);
  if (!access) return { error: `ليست لديك صلاحية إضافة ${studentsNoun(NEUTRAL_GROUP_GENDER)} في هذه الدورة` };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "يُرجى اختيار ملف Excel" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "يُرجى رفع ملف بصيغة ‎.xlsx‎" };
  if (file.size > MAX_FILE_BYTES) return { error: "حجم الملف كبير جدًا" };

  const parsed = await parseImportWorkbook(await file.arrayBuffer());
  if ("error" in parsed) return { error: parsed.error };

  // every group and field of the course, so a row or column outside her
  // scope is reported as such rather than as unknown
  const [groups, existing, infoFields] = await Promise.all([
    prisma.group.findMany({ where: { courseId: access.courseId }, select: { id: true, name: true, gender: true } }),
    prisma.student.findMany({ where: { courseId: access.courseId }, select: { name: true } }),
    getCourseInfoFields(access.courseId),
  ]);
  // extra-info columns: an out-of-date template refuses the whole file
  const fillable = new Set(access.infoFields.map((f) => f.id));
  const info = matchInfoColumns(parsed.infoHeaders, infoFields, access.studentInfoEnabled, (f) => fillable.has(f.id));
  if ("error" in info) return { error: info.error };
  const { toCreate, skipped } = matchImportRows(
    parsed.rows,
    groups,
    existing.map((s) => s.name),
    info.columns,
    access.groupLimit,
  );

  if (toCreate.length > 0) {
    const teacherId = await resolveTeacherId(session);
    await prisma.$transaction(
      async (tx) => {
        for (const { groupId, student, info } of toCreate) {
          await tx.student.create({
            data: {
              ...studentCreateData(student, { courseId: access.courseId, groupId, teacherId }),
              infoValues: { createMany: { data: info.map((v) => ({ ...v, updatedBy: access.updatedBy })) } },
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
