import { SignJWT, jwtVerify } from "jose";

// Token-only half of the parent session (no DB, no next/headers) so the
// proxy can verify signatures cheaply. See parent-session.ts for why this is
// a separate system from staff sessions.
export const PARENT_COOKIE_NAME = "namaa_parent";
export const PARENT_COOKIE_PATH = "/parent";
const AUDIENCE = "namaa-parent";
const parentKey = () => new TextEncoder().encode(`${process.env.SESSION_SECRET}:parent-session`);

export interface ParentTokenPayload {
  studentId: string;
  // must equal Student.parentCodeVersion; regenerating/revoking the code
  // bumps it, which kills every session issued under the old code
  v: number;
}

export async function verifyParentToken(token: string): Promise<ParentTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, parentKey(), { audience: AUDIENCE });
    if (typeof payload.studentId !== "string" || typeof payload.v !== "number") return null;
    return { studentId: payload.studentId, v: payload.v };
  } catch {
    return null;
  }
}

export async function signParentToken(payload: ParentTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(parentKey());
}
