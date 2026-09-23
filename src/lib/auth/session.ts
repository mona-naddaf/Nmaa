import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE_NAME = "namaa_session";
const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    // Only ever accept staff roles here. Parent tokens are signed with a
    // different key (parent-session.ts) and would already fail the signature
    // check — this is the second guard, not the first.
    if (payload.role !== "admin" && payload.role !== "teacher") return null;
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export type Session =
  | { role: "admin"; adminId: string; courseId: string }
  | { role: "teacher"; teacherId: string; teacherName: string; courseId: string };

export async function createSession(session: Session) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
