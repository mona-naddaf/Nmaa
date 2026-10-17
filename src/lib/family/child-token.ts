import { createScopedToken } from "@/lib/auth/scoped-token";

// Token-only half of a child's «العائلة» session (no DB, no next/headers) so
// the proxy can verify signatures cheaply. Its own cookie, scoped to /family
// (never sent to /rafiq, where the adults' cookie lives, and the adults'
// cookie is never sent here), its own signing key and audience — see
// scoped-token.ts — so it opens nothing anywhere else.
export const CHILD_COOKIE_NAME = "namaa_family";
export const CHILD_COOKIE_PATH = "/family";
export const CHILD_SESSION_DAYS = 90; // same as student sessions

export interface ChildTokenPayload {
  uid: string;
  // must equal RafiqUser.childCodeVersion; a new رمز or «إيقاف الدخول» bumps it
  v: number;
  [key: string]: string | number;
}

const token = createScopedToken<ChildTokenPayload>({
  scope: "family-child",
  ttl: `${CHILD_SESSION_DAYS}d`,
  isPayload: (p) => typeof p.uid === "string" && typeof p.v === "number",
});

export async function verifyChildToken(raw: string): Promise<ChildTokenPayload | null> {
  const payload = await token.verify(raw);
  return payload && { uid: payload.uid, v: payload.v };
}

export const signChildToken = (payload: ChildTokenPayload) => token.sign(payload);
