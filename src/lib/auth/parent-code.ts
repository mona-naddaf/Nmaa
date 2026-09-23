import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

// Same unambiguous alphabet as the course code (no 0/O, 1/I/L), but drawn
// with a CSPRNG: this code alone is what stands between a stranger and a
// child's data, so Math.random isn't good enough here.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += CHARSET[randomInt(CHARSET.length)];
  }
  return out;
}

export async function generateUniqueParentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await prisma.student.findUnique({ where: { parentCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("تعذّر توليد رمز فريد، يُرجى المحاولة مرة أخرى");
}

// accepts the code typed with or without the dash, in any case
export function normalizeParentCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

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
