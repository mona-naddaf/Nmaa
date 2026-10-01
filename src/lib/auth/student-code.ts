import "server-only";
import { prisma } from "@/lib/db";
import { normalizeAccessCode, randomAccessCode } from "./access-code";

// Student login codes — the same format and lifecycle as parent codes
// (parent-code.ts), in their own column, so neither code opens the other area.

async function generateUniqueStudentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomAccessCode();
    const existing = await prisma.student.findUnique({ where: { studentCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("تعذّر توليد رمز فريد، يُرجى المحاولة مرة أخرى");
}

/**
 * Gives a student a fresh code. Bumping studentCodeVersion ends every session
 * opened with a previous code, so this doubles as "revoke and replace". With
 * `onlyIfMissing`, a student who got a code in the meantime is left untouched
 * and null is returned. Callers check permission and ownership first.
 */
export async function issueStudentCode(
  studentId: string,
  { onlyIfMissing = false }: { onlyIfMissing?: boolean } = {},
): Promise<{ code: string; createdAt: Date } | null> {
  const code = await generateUniqueStudentCode();
  const createdAt = new Date();
  const { count } = await prisma.student.updateMany({
    where: { id: studentId, archivedAt: null, ...(onlyIfMissing ? { studentCode: null } : {}) },
    data: { studentCode: code, studentCodeVersion: { increment: 1 }, studentCodeCreatedAt: createdAt },
  });
  return count === 1 ? { code, createdAt } : null;
}

export async function revokeStudentCode(studentId: string) {
  await prisma.student.update({
    where: { id: studentId },
    data: { studentCode: null, studentCodeVersion: { increment: 1 }, studentCodeCreatedAt: null },
  });
}

/**
 * Issues a code to every active student in scope who has never had one.
 * Revoked codes (version > 0) are skipped: revoking is deliberate, and a bulk
 * action shouldn't silently undo it.
 */
export async function issueMissingStudentCodes(
  courseId: string,
  groupIds: string[] | null,
): Promise<{ created: number; needed: number; failed: boolean }> {
  const missing = await prisma.student.findMany({
    where: {
      courseId,
      archivedAt: null,
      studentCode: null,
      studentCodeVersion: 0,
      ...(groupIds ? { groupId: { in: groupIds } } : {}),
    },
    select: { id: true },
  });
  let created = 0;
  try {
    for (const s of missing) {
      if (await issueStudentCode(s.id, { onlyIfMissing: true })) created++;
    }
  } catch {
    return { created, needed: missing.length, failed: true };
  }
  return { created, needed: missing.length, failed: false };
}

export function studentCodeStatus(s: { studentCode: string | null; studentCodeVersion: number }): "active" | "revoked" | "none" {
  if (s.studentCode) return "active";
  return s.studentCodeVersion > 0 ? "revoked" : "none";
}

export const normalizeStudentCode = normalizeAccessCode;
