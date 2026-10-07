import { createScopedToken } from "@/lib/auth/scoped-token";

// Token-only half of the «رفيق الحفظ» session (no DB, no next/headers) so the
// proxy can verify signatures cheaply. Its own cookie (scoped to /rafiq), its
// own signing key and audience — see scoped-token.ts — so it opens nothing
// in the course areas and no course session opens anything here.
export const RAFIQ_COOKIE_NAME = "namaa_rafiq";
export const RAFIQ_COOKIE_PATH = "/rafiq";
export const RAFIQ_SESSION_DAYS = 180; // same as staff sessions

export interface RafiqTokenPayload {
  uid: string;
  // must equal RafiqUser.sessionVersion; bumping it ends every session
  v: number;
  [key: string]: string | number;
}

const token = createScopedToken<RafiqTokenPayload>({
  scope: "rafiq",
  ttl: `${RAFIQ_SESSION_DAYS}d`,
  isPayload: (p) => typeof p.uid === "string" && typeof p.v === "number",
});

export async function verifyRafiqToken(raw: string): Promise<RafiqTokenPayload | null> {
  const payload = await token.verify(raw);
  return payload && { uid: payload.uid, v: payload.v };
}

export const signRafiqToken = (payload: RafiqTokenPayload) => token.sign(payload);
