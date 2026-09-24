import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Signed tokens for the non-staff access paths (parent, public board). Each
// scope gets its own HMAC key (derived from SESSION_SECRET plus the scope
// name) and its own audience, so a token from one scope can never verify in
// another — or as a staff session, whose key is the bare secret. No DB and
// no next/headers here, so the proxy can use it.
export function createScopedToken<P extends Record<string, string | number>>({
  scope,
  ttl,
  isPayload,
}: {
  scope: string;
  ttl: string;
  isPayload: (payload: JWTPayload) => boolean;
}) {
  const audience = `namaa-${scope}`;
  const key = () => new TextEncoder().encode(`${process.env.SESSION_SECRET}:${scope}-session`);

  return {
    async sign(payload: P): Promise<string> {
      return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(ttl)
        .sign(key());
    },
    async verify(token: string): Promise<P | null> {
      try {
        const { payload } = await jwtVerify(token, key(), { audience });
        return isPayload(payload) ? (payload as unknown as P) : null;
      } catch {
        return null;
      }
    },
  };
}
