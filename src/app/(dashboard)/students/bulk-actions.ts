"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require";
import { bulkAttendance, bulkPoint, undoBulk, type BulkResult, type UndoResult } from "@/lib/students/bulk";

// The students page's «تحديد» bar: the signed-in user, then lib/students/bulk.ts
// (which checks every student again), then the pages it changed are refreshed.

export type { BulkResult, UndoResult };

function refresh<T extends { touched?: string[] } | { error: string }>(result: T): T {
  if ("touched" in result && result.touched) {
    revalidatePath("/students");
    for (const id of result.touched) revalidatePath(`/students/${id}`);
  }
  return result;
}

export async function bulkAttendanceAction(studentIds: unknown, status: unknown): Promise<BulkResult> {
  return refresh(await bulkAttendance(await requireSession(), studentIds, status));
}

export async function bulkPointAction(studentIds: unknown, activityId: unknown, noteInput: unknown): Promise<BulkResult> {
  return refresh(await bulkPoint(await requireSession(), studentIds, activityId, noteInput));
}

export async function undoBulkAction(token: unknown): Promise<UndoResult> {
  return refresh(await undoBulk(await requireSession(), token));
}
