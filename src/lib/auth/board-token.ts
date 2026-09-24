import { createScopedToken } from "./scoped-token";

// Token-only half of the public-board session (no DB, no next/headers) so
// the proxy can verify signatures cheaply. See board-session.ts.
export const BOARD_COOKIE_NAME = "namaa_board";
export const BOARD_COOKIE_PATH = "/board";

export interface BoardTokenPayload {
  courseId: string;
  // must equal Course.boardCodeVersion; regenerating/revoking the code
  // bumps it, which kills every session issued under the old code
  v: number;
  [key: string]: string | number;
}

const token = createScopedToken<BoardTokenPayload>({
  scope: "board",
  ttl: "30d",
  isPayload: (p) => typeof p.courseId === "string" && typeof p.v === "number",
});

export async function verifyBoardToken(raw: string): Promise<BoardTokenPayload | null> {
  const payload = await token.verify(raw);
  return payload && { courseId: payload.courseId, v: payload.v };
}

export const signBoardToken = (payload: BoardTokenPayload) => token.sign(payload);
