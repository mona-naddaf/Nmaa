"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require";
import { resolveTeacherId } from "@/lib/auth/teacher-identity";
import { endStudentExcuse, excuseFor, settleStudentExpired, staffViewer, startStudentExcuse } from "@/lib/excuse/course-data";
import type { ExcuseResult, MomentInput } from "@/lib/excuse/rafiq-data";

// «أيام العذر» from a student's staff page: «بدء العذر», «انتهى العذر»,
// closing one past its 15 days, and «إظهار العذر لوليّ الأمر». Each re-checks
// who is asking: only staff who may act on her excuse (visibility.ts).

const OFF = { error: "أيام العذر غير مفعّلة — يمكن تفعيلها من الإعدادات" };

async function target(studentId: unknown) {
  const session = await requireSession();
  const s = await prisma.student.findFirst({ where: { id: String(studentId ?? ""), courseId: session.courseId, archivedAt: null }, select: { id: true } });
  if (!s) return null;
  return { session, id: s.id, excuse: await excuseFor(s.id, await staffViewer(session)) };
}

function refresh(studentId: string) {
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/tracker");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

export async function startStudentExcuseAction(input: { studentId: string; at: MomentInput }): Promise<ExcuseResult> {
  const t = await target(input?.studentId);
  if (!t?.excuse.on) return OFF;
  const r = await startStudentExcuse(t.id, input.at, t.excuse.you, { teacherId: await resolveTeacherId(t.session) });
  if (!r.error) refresh(t.id);
  return r;
}

export async function endStudentExcuseAction(input: { studentId: string; at: MomentInput }): Promise<ExcuseResult> {
  const t = await target(input?.studentId);
  if (!t?.excuse.on) return OFF;
  const r = await endStudentExcuse(t.id, input.at, t.excuse.you, { teacherId: await resolveTeacherId(t.session) });
  if (!r.error) refresh(t.id);
  return r;
}

/** Her page found her excuse past its 15 days: it ends at its cap. */
export async function settleStudentExcuseAction(input: { studentId: string }): Promise<ExcuseResult> {
  const t = await target(input?.studentId);
  if (!t?.excuse.show) return {};
  const autoEnded = await settleStudentExpired(t.id);
  if (autoEnded) refresh(t.id);
  return { autoEnded };
}

/** G5: the supervisor only. Off by default. */
export async function setExcuseParentVisibleAction(input: { studentId: string; on: boolean }): Promise<{ error?: string }> {
  const t = await target(input?.studentId);
  if (!t || t.session.role !== "admin" || !t.excuse.mark) return OFF;
  await prisma.student.update({ where: { id: t.id }, data: { excuseParentVisible: input.on === true } });
  refresh(t.id);
  return {};
}
