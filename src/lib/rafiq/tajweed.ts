import "server-only";
import { prisma } from "@/lib/db";
import { summarize, SUMMARY_RECENT_DAYS, type TajweedSummary } from "@/lib/tajweed/summary";
import type { TajweedKind } from "@/lib/tajweed/taxonomy";

// «أخطاء التجويد المفصّلة» in «رفيق الحفظ» (lib/tajweed): her own setting,
// off by default. Everything here is scoped to her user id.

/** Whether she has detailed tajweed on (her settings). */
export async function rafiqTajweedOn(userId: string): Promise<boolean> {
  const u = await prisma.rafiqUser.findUnique({ where: { id: userId }, select: { tajweedDetailEnabled: true } });
  return u?.tajweedDetailEnabled === true;
}

/**
 * «ملخّص أخطاء التجويد» on her «صفحتي»: her open detailed mistakes, from
 * her sessions and her home practice alike (she is the only one who sees
 * either), for the last 30 days and the whole period. null when she has
 * the setting off or nothing to count.
 */
export async function rafiqTajweedSummary(userId: string): Promise<TajweedSummary | null> {
  if (!(await rafiqTajweedOn(userId))) return null;
  const where = { userId, resolvedAt: null, tajweedKind: { not: "NONE" as const } };
  const select = { tajweedKind: true, tajweedCode: true, letterText: true, flaggedAt: true } as const;
  const [sessions, home] = await Promise.all([
    prisma.rafiqMistake.findMany({ where, select }),
    prisma.rafiqHomeMistake.findMany({ where, select }),
  ]);
  const rows = [...sessions, ...home];
  if (rows.length === 0) return null;
  // her days are her own device's; the window is the last 30 × 24 hours
  const since = Date.now() - SUMMARY_RECENT_DAYS * 24 * 60 * 60 * 1000;
  const toRow = (r: (typeof rows)[number]) => ({ kind: r.tajweedKind as TajweedKind, code: r.tajweedCode, letterText: r.letterText });
  return {
    recent: summarize(rows.filter((r) => r.flaggedAt.getTime() >= since).map(toRow)),
    all: summarize(rows.map(toRow)),
  };
}
