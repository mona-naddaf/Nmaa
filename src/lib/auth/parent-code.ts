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
