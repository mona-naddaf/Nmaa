import "server-only";
import { prisma } from "@/lib/db";
import { randomAccessCode } from "@/lib/auth/access-code";

// A child's login رمز — the same format and lifecycle as a student's
// (src/lib/auth/student-code.ts): issuing a new one, or stopping login, bumps
// childCodeVersion, which ends every session opened with an earlier رمز.
// Callers check the family and the adult's edit rights first.

export async function uniqueChildCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomAccessCode();
    if (!(await prisma.rafiqUser.findUnique({ where: { childCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("تعذّر توليد رمز فريد، يُرجى المحاولة مرة أخرى");
}

/** A new رمز for one child of the family (ends her open sessions). false when she isn't there. */
export async function issueChildCode(familyId: string, childId: string): Promise<boolean> {
  const { count } = await prisma.rafiqUser.updateMany({
    where: { id: childId, familyId, kind: "CHILD" },
    data: { childCode: await uniqueChildCode(), childCodeCreatedAt: new Date(), childCodeVersion: { increment: 1 } },
  });
  return count > 0;
}

/** «إيقاف الدخول»: no رمز until an adult issues a new one (ends her open sessions). */
export async function stopChildLogin(familyId: string, childId: string): Promise<boolean> {
  const { count } = await prisma.rafiqUser.updateMany({
    where: { id: childId, familyId, kind: "CHILD" },
    data: { childCode: null, childCodeCreatedAt: null, childCodeVersion: { increment: 1 } },
  });
  return count > 0;
}
