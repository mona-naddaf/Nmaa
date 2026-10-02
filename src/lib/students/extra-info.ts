import "server-only";
import type { InfoEditor, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";
import { canEditStudents } from "./manage";
import { BUILTIN_ORDER, fieldVisibleTo, type InfoChange, type InfoField, type InfoViewer } from "./extra-info-rules";

// Loading and saving «معلومات إضافية». Every server action that reads or
// writes it goes through the access functions here; the UI only hides what
// these refuse anyway. Never imported by the student portal, the board or
// reports.

type Permission = "ADMIN_ONLY" | "ALL_TEACHERS";

export interface InfoAccess {
  viewer: InfoViewer;
  // the enabled fields she sees; empty when the feature is off
  see: boolean;
  // she may also fill/edit those same fields
  edit: boolean;
}

/** Staff on a student's page (the caller has already applied the groups rule). */
export function staffInfoAccess(
  session: Session,
  course: { studentInfoEnabled: boolean; editStudentsPermission: Permission },
): InfoAccess {
  const viewer = session.role === "admin" ? "admin" : "teacher";
  if (!course.studentInfoEnabled) return { viewer, see: false, edit: false };
  return { viewer, see: true, edit: canEditStudents(session, course) };
}

/** A parent: the section exists only while the course lets parents fill it. */
export function parentInfoAccess(course: { studentInfoEnabled: boolean; parentStudentInfoEdit: boolean }): InfoAccess {
  const on = course.studentInfoEnabled && course.parentStudentInfoEdit;
  return { viewer: "parent", see: on, edit: on };
}

export const editorFor = (viewer: InfoViewer): InfoEditor =>
  viewer === "admin" ? "ADMIN" : viewer === "teacher" ? "TEACHER" : "PARENT";

const FIELD_SELECT = {
  id: true,
  builtinKey: true,
  label: true,
  enabled: true,
  required: true,
  visibleToTeachers: true,
  visibleToParents: true,
  sortOrder: true,
} as const;

/**
 * Creates any missing built-in field rows for the course, all disabled, in
 * the standard order and after anything already there. Idempotent.
 */
export async function ensureBuiltinFields(courseId: string): Promise<void> {
  const existing = await prisma.studentInfoField.findMany({
    where: { courseId },
    select: { builtinKey: true, sortOrder: true },
  });
  const have = new Set(existing.map((f) => f.builtinKey));
  const missing = BUILTIN_ORDER.filter((k) => !have.has(k));
  if (missing.length === 0) return;
  const start = existing.reduce((max, f) => Math.max(max, f.sortOrder + 1), 0);
  await prisma.studentInfoField.createMany({
    data: missing.map((builtinKey, i) => ({ courseId, builtinKey, sortOrder: start + i })),
    skipDuplicates: true,
  });
}

/** Every field of the course (enabled or not), in display order. */
export async function getCourseInfoFields(courseId: string): Promise<InfoField[]> {
  return prisma.studentInfoField.findMany({
    where: { courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: FIELD_SELECT,
  });
}

/** The fields this viewer sees (and, with edit access, may edit). */
export async function visibleInfoFields(courseId: string, access: InfoAccess): Promise<InfoField[]> {
  if (!access.see) return [];
  return (await getCourseInfoFields(courseId)).filter((f) => fieldVisibleTo(f, access.viewer));
}

export interface StoredInfoValue {
  value: string;
  updatedBy: InfoEditor;
  updatedAt: Date;
}

/** A student's stored values for the given fields only, by field id. */
export async function getStudentInfoValues(
  studentId: string,
  fields: Pick<InfoField, "id">[],
): Promise<Record<string, StoredInfoValue>> {
  if (fields.length === 0) return {};
  const rows = await prisma.studentInfoValue.findMany({
    where: { studentId, fieldId: { in: fields.map((f) => f.id) } },
    select: { fieldId: true, value: true, updatedBy: true, updatedAt: true },
  });
  return Object.fromEntries(rows.map(({ fieldId, ...v }) => [fieldId, v]));
}

export const plainValues = (values: Record<string, StoredInfoValue>): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([id, v]) => [id, v.value]));

/** Applies validated changes (null = cleared → the row is deleted). */
export async function writeInfoChanges(
  tx: Prisma.TransactionClient,
  studentId: string,
  changes: InfoChange[],
  editor: InfoEditor,
): Promise<void> {
  for (const { fieldId, value } of changes) {
    if (value === null) {
      await tx.studentInfoValue.deleteMany({ where: { studentId, fieldId } });
    } else {
      await tx.studentInfoValue.upsert({
        where: { studentId_fieldId: { studentId, fieldId } },
        create: { studentId, fieldId, value, updatedBy: editor },
        update: { value, updatedBy: editor },
      });
    }
  }
}
