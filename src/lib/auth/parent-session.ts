import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  PARENT_COOKIE_NAME,
  PARENT_COOKIE_PATH,
  signParentToken,
  verifyParentToken,
  type ParentTokenPayload,
} from "./parent-token";

// Parent sessions are deliberately a separate system from staff sessions
// (session.ts): their own cookie (scoped to /parent), their own signing key,
// their own audience. A parent token therefore can't verify as a staff token
// even if copied into the staff cookie, and the only thing it carries is one
// studentId — there is no courseId in it for a code path to widen access with.

export async function createParentSession(payload: ParentTokenPayload) {
  const store = await cookies();
  store.set(PARENT_COOKIE_NAME, await signParentToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: PARENT_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function destroyParentSession() {
  const store = await cookies();
  // expire it at the same path it was set on — delete(name) targets path "/"
  store.set(PARENT_COOKIE_NAME, "", { path: PARENT_COOKIE_PATH, maxAge: 0 });
}

/**
 * The studentId this parent may view, or null. Checks the token AND that the
 * student still has an active code at the same version — a revoked or
 * regenerated code invalidates the session on the very next request.
 */
export async function getParentStudentId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PARENT_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyParentToken(token);
  if (!payload) return null;

  const student = await prisma.student.findUnique({
    where: { id: payload.studentId },
    select: { parentCode: true, parentCodeVersion: true },
  });
  if (!student?.parentCode || student.parentCodeVersion !== payload.v) return null;
  return payload.studentId;
}

export async function requireParentStudentId(): Promise<string> {
  const studentId = await getParentStudentId();
  if (!studentId) redirect("/parent/login");
  return studentId;
}
