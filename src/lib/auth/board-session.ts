import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  BOARD_COOKIE_NAME,
  BOARD_COOKIE_PATH,
  signBoardToken,
  verifyBoardToken,
  type BoardTokenPayload,
} from "./board-token";

// Public read-only leaderboard sessions: a third, separate system alongside
// staff (session.ts) and parent (parent-session.ts) sessions — own cookie
// scoped to /board, own signing key, own audience. The token carries only a
// courseId and the code version; the only thing it unlocks is that course's
// leaderboard (src/lib/board/data.ts).

export async function createBoardSession(payload: BoardTokenPayload) {
  const store = await cookies();
  store.set(BOARD_COOKIE_NAME, await signBoardToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: BOARD_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroyBoardSession() {
  const store = await cookies();
  // expire it at the same path it was set on — delete(name) targets path "/"
  store.set(BOARD_COOKIE_NAME, "", { path: BOARD_COOKIE_PATH, maxAge: 0 });
}

/**
 * The courseId whose board this visitor may view, or null. Checks the token
 * AND that the course still has an active board code at the same version.
 */
export async function getBoardCourseId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(BOARD_COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = await verifyBoardToken(raw);
  if (!payload) return null;

  const course = await prisma.course.findUnique({
    where: { id: payload.courseId },
    select: { boardCode: true, boardCodeVersion: true },
  });
  if (!course?.boardCode || course.boardCodeVersion !== payload.v) return null;
  return payload.courseId;
}

export async function requireBoardCourseId(): Promise<string> {
  const courseId = await getBoardCourseId();
  if (!courseId) redirect("/board/login");
  return courseId;
}
