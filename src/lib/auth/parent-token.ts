import { createScopedToken } from "./scoped-token";

// Token-only half of the parent session (no DB, no next/headers) so the
// proxy can verify signatures cheaply. See parent-session.ts for why this is
// a separate system from staff sessions.
export const PARENT_COOKIE_NAME = "namaa_parent";
export const PARENT_COOKIE_PATH = "/parent";

export interface ParentTokenPayload {
  studentId: string;
  // must equal Student.parentCodeVersion; regenerating/revoking the code
  // bumps it, which kills every session issued under the old code
  v: number;
  [key: string]: string | number;
}

const token = createScopedToken<ParentTokenPayload>({
  scope: "parent",
  ttl: "90d",
  isPayload: (p) => typeof p.studentId === "string" && typeof p.v === "number",
});

export async function verifyParentToken(raw: string): Promise<ParentTokenPayload | null> {
  const payload = await token.verify(raw);
  return payload && { studentId: payload.studentId, v: payload.v };
}

export const signParentToken = (payload: ParentTokenPayload) => token.sign(payload);
