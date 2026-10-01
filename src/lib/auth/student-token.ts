import { createScopedToken } from "./scoped-token";

// Token-only half of the student session (no DB, no next/headers) so the
// proxy can verify signatures cheaply. A fourth, separate system alongside
// staff, parent and public-board sessions: own cookie (scoped to /student),
// own signing key, own audience — see scoped-token.ts.
export const STUDENT_COOKIE_NAME = "namaa_student";
export const STUDENT_COOKIE_PATH = "/student";
export const STUDENT_SESSION_DAYS = 90; // same as parent sessions

export interface StudentTokenPayload {
  studentId: string;
  // must equal Student.studentCodeVersion; regenerating/revoking the code
  // bumps it, which kills every session issued under the old code
  v: number;
  [key: string]: string | number;
}

const token = createScopedToken<StudentTokenPayload>({
  scope: "student",
  ttl: `${STUDENT_SESSION_DAYS}d`,
  isPayload: (p) => typeof p.studentId === "string" && typeof p.v === "number",
});

export async function verifyStudentToken(raw: string): Promise<StudentTokenPayload | null> {
  const payload = await token.verify(raw);
  return payload && { studentId: payload.studentId, v: payload.v };
}

export const signStudentToken = (payload: StudentTokenPayload) => token.sign(payload);
