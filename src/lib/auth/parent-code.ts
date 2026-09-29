import "server-only";
import { prisma } from "@/lib/db";
import { normalizeAccessCode, randomAccessCode } from "./access-code";

export async function generateUniqueParentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomAccessCode();
    const existing = await prisma.student.findUnique({ where: { parentCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("تعذّر توليد رمز فريد، يُرجى المحاولة مرة أخرى");
}

/**
 * Gives a student a fresh parent code. Bumping parentCodeVersion invalidates
 * every session opened with a previous code, so this doubles as "revoke and
 * replace". With `onlyIfMissing`, a student who got a code in the meantime
 * (another tab, a concurrent bulk run) is left untouched and null is
 * returned. Callers are responsible for checking the supervisor owns it.
 */
export async function issueParentCode(
  studentId: string,
  { onlyIfMissing = false }: { onlyIfMissing?: boolean } = {},
): Promise<{ code: string; createdAt: Date } | null> {
  const code = await generateUniqueParentCode();
  const createdAt = new Date();
  const { count } = await prisma.student.updateMany({
    where: { id: studentId, ...(onlyIfMissing ? { parentCode: null } : {}) },
    data: { parentCode: code, parentCodeVersion: { increment: 1 }, parentCodeCreatedAt: createdAt },
  });
  return count === 1 ? { code, createdAt } : null;
}

/**
 * Issues a code to every student in the course who has never had one.
 * Students with an active code are skipped, and so are students whose code
 * was revoked (parentCodeVersion > 0): revoking is a deliberate decision a
 * bulk action shouldn't silently undo — those are re-issued one at a time.
 * Returns how many were created and how many needed one; on a failure
 * part-way, the ones already created stay created.
 */
export async function issueMissingParentCodes(courseId: string): Promise<{ created: number; needed: number; failed: boolean }> {
  const missing = await prisma.student.findMany({
    where: { courseId, parentCode: null, parentCodeVersion: 0 },
    select: { id: true },
  });
  let created = 0;
  try {
    for (const s of missing) {
      if (await issueParentCode(s.id, { onlyIfMissing: true })) created++;
    }
  } catch {
    return { created, needed: missing.length, failed: true };
  }
  return { created, needed: missing.length, failed: false };
}

/** A null code with version > 0 means a code existed and was revoked. */
export function parentCodeStatus(s: { parentCode: string | null; parentCodeVersion: number }): "active" | "revoked" | "none" {
  if (s.parentCode) return "active";
  return s.parentCodeVersion > 0 ? "revoked" : "none";
}

export const normalizeParentCode = normalizeAccessCode;

// Folds the spelling variations people commonly type for the same Arabic
// name: diacritics/tatweel, hamza-carrying alef forms, alef maqsura vs ya,
// ta marbuta vs ha, hamza on waw/ya. Latin names are just lowercased.
export function normalizePersonName(raw: string): string {
  return raw
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lenient on purpose — the code is the real secret. Accepts the registered
 * full name or just its first word, after normalization.
 */
export function parentNameMatches(typed: string, registered: string): boolean {
  const t = normalizePersonName(typed);
  const r = normalizePersonName(registered);
  if (!t) return false;
  return t === r || t === r.split(" ")[0];
}
