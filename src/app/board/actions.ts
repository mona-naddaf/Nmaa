"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createBoardSession, destroyBoardSession } from "@/lib/auth/board-session";
import { normalizeAccessCode } from "@/lib/auth/access-code";
import { isLoginLocked, recordLoginFailure } from "@/lib/auth/login-lockout";

export type BoardLoginState = { error?: string } | null;

// Deliberately the only two server actions in the board area: enter and
// exit. Nothing reachable from the public board writes any data.

export async function boardLoginAction(_prev: BoardLoginState, formData: FormData): Promise<BoardLoginState> {
  const code = normalizeAccessCode(String(formData.get("code") ?? ""));
  if (!code) {
    return { error: "يُرجى إدخال كود لوحة الإنجاز" };
  }

  if (await isLoginLocked("BOARD")) {
    return { error: "محاولات دخول كثيرة غير صحيحة — يُرجى المحاولة مرة أخرى بعد ربع ساعة" };
  }

  const course = await prisma.course.findUnique({
    where: { boardCode: code },
    select: { id: true, boardCodeVersion: true },
  });
  if (!course) {
    await recordLoginFailure("BOARD");
    return { error: "الكود غير صحيح — يُرجى التأكد منه مع مشرف الدورة" };
  }

  await createBoardSession({ courseId: course.id, v: course.boardCodeVersion });
  redirect("/board");
}

export async function boardLogoutAction() {
  await destroyBoardSession();
  redirect("/board/login");
}
