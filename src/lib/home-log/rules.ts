// Rules for the home memorization log, shared by the server actions (which
// enforce them) and the UI (which only mirrors them). Pure: no DB, no
// server-only imports.

import { AYAH_COUNT } from "@/lib/quran-data";

export const HOME_LIMITS = {
  maxActiveSegments: 5,
  maxAyat: 40,
  tapsPerMinute: 60,
  segmentsPerDay: 20,
  targetMin: 1,
  targetMax: 100,
} as const;

export type HomeTapKind = "LISTEN" | "REPEAT" | "RECITE";
export const HOME_TAP_KINDS: HomeTapKind[] = ["LISTEN", "REPEAT", "RECITE"];

export const HOME_TAP_LABEL: Record<HomeTapKind, string> = {
  LISTEN: "سماع",
  REPEAT: "تكرار",
  RECITE: "تسميع لأحد",
};

export const HOME_TAP_ICON: Record<HomeTapKind, string> = { LISTEN: "🎧", REPEAT: "🔁", RECITE: "🗣️" };

export type HomeTargets = { listen: number; repeat: number; recite: number };
export type HomeCounts = { LISTEN: number; REPEAT: number; RECITE: number };

export const EMPTY_COUNTS: HomeCounts = { LISTEN: 0, REPEAT: 0, RECITE: 0 };

export function targetFor(targets: HomeTargets, kind: HomeTapKind): number {
  return kind === "LISTEN" ? targets.listen : kind === "REPEAT" ? targets.repeat : targets.recite;
}

export function allTargetsMet(counts: HomeCounts, targets: HomeTargets): boolean {
  return HOME_TAP_KINDS.every((k) => counts[k] >= targetFor(targets, k));
}

/** A real range of one surah, at most maxAyat long; or an error message. */
export function validateRange(surahNumber: number, fromAyah: number, toAyah: number): string | null {
  const count = AYAH_COUNT[surahNumber];
  if (!Number.isInteger(surahNumber) || !count) return "يُرجى اختيار سورة صحيحة";
  if (!Number.isInteger(fromAyah) || !Number.isInteger(toAyah) || fromAyah < 1 || toAyah > count || toAyah < fromAyah) {
    return "يُرجى اختيار آيات صحيحة من السورة";
  }
  if (toAyah - fromAyah + 1 > HOME_LIMITS.maxAyat) return `يُرجى ألّا يزيد المقطع على ${HOME_LIMITS.maxAyat} آية`;
  return null;
}

export function validateTargets(t: Partial<HomeTargets> | null | undefined): HomeTargets | null {
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= HOME_LIMITS.targetMin && (n as number) <= HOME_LIMITS.targetMax;
  if (!t || !ok(t.listen) || !ok(t.repeat) || !ok(t.recite)) return null;
  return { listen: t.listen!, repeat: t.repeat!, recite: t.recite! };
}

/**
 * The student's own local date ("YYYY-MM-DD") as her browser reports it,
 * accepted only if it's a real date within a day of the server's UTC date —
 * time zones differ by at most that. Taps are stored by this day.
 */
export function acceptLocalDay(day: string, now: Date = new Date()): string | null {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  if (new Date(t).toISOString().slice(0, 10) !== day) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(t - today) <= 24 * 60 * 60 * 1000 ? day : null;
}

/** Her browser's local date as "YYYY-MM-DD". Client-side only. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
