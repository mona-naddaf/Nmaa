import "server-only";
import { prisma } from "@/lib/db";
import { randomAccessCode } from "./access-code";

export async function generateUniqueBoardCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomAccessCode();
    const existing = await prisma.course.findUnique({ where: { boardCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("تعذّر توليد كود فريد، يُرجى المحاولة مرة أخرى");
}
