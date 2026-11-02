"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getStudentAccess } from "@/lib/auth/student-session";
import { endStudentExcuse, excuseFor, settleStudentExpired, startStudentExcuse } from "@/lib/excuse/course-data";
import type { ExcuseResult, MomentInput } from "@/lib/excuse/rafiq-data";
import { validateItemExcuse } from "@/lib/excuse/rules";

// «أيام العذر» from a student's own tracker: her own excuse, and the setting
// of her own items. Every action re-checks her session and that it reaches
// her (a girls group of a course that has it on).

const OFF = { error: "أيام العذر غير مفعّلة — يمكن تفعيلها من الإعدادات" };

async function me() {
  const access = await getStudentAccess();
  if (!access?.trackerEnabled) return null;
  return { id: access.studentId, excuse: await excuseFor(access.studentId, { kind: "STUDENT", studentId: access.studentId }) };
}

function refresh(studentId: string) {
  revalidatePath("/student", "layout");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/tracker");
  revalidatePath("/parent", "layout");
}

export async function startMyExcuseAction(input: { at: MomentInput }): Promise<ExcuseResult> {
  const m = await me();
  if (!m?.excuse.on) return OFF;
  const r = await startStudentExcuse(m.id, input?.at, "FEMALE", { teacherId: null });
  if (!r.error) refresh(m.id);
  return r;
}

export async function endMyExcuseAction(input: { at: MomentInput }): Promise<ExcuseResult> {
  const m = await me();
  if (!m?.excuse.on) return OFF;
  const r = await endStudentExcuse(m.id, input?.at, "FEMALE", { teacherId: null });
  if (!r.error) refresh(m.id);
  return r;
}

/** Her page found her excuse past its 15 days: it ends at its cap. */
export async function settleMyExcuseAction(): Promise<ExcuseResult> {
  const m = await me();
  if (!m?.excuse.show) return {};
  const autoEnded = await settleStudentExpired(m.id);
  if (autoEnded) refresh(m.id);
  return { autoEnded };
}

/** B: «في أيام العذر» on one of her own items. */
export async function setOwnItemExcuseAction(itemId: string, excuse: { mode: unknown; alt: unknown }): Promise<{ error?: string }> {
  const m = await me();
  if (!m?.excuse.act) return OFF;
  const v = validateItemExcuse(excuse?.mode, excuse?.alt, "FEMALE");
  if ("error" in v) return v;
  const { count } = await prisma.trackerItem.updateMany({ where: { id: String(itemId ?? ""), createdByStudentId: m.id, archivedAt: null }, data: v });
  if (count === 0) return { error: "لم يُعثر على هذا البند" };
  refresh(m.id);
  return {};
}
