import "server-only";
import { prisma } from "@/lib/db";

// avoid visually ambiguous characters (0/O, 1/I/L) since teachers type this by hand
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function randomFrom(charset: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

export async function generateUniqueCourseCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${randomFrom(LETTERS, 4)}-${randomFrom(DIGITS, 4)}`;
    const existing = await prisma.course.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("تعذّر توليد كود فريد للدورة، يُرجى المحاولة مرة أخرى");
}

export function normalizeCourseCode(raw: string): string {
  return raw.trim().toUpperCase();
}
