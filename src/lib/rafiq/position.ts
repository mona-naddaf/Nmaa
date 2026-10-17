// Pure position rules of «رفيق الحفظ» (no DB): shared by memorization.ts and
// the family dashboard (src/lib/family/dashboard-build.ts).

export type SessionRow = {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  type: "NEW" | "REVIEW" | "LINK";
  situation: "CONTINUE" | "NEXT" | "SURAH_GAP" | "AYAH_GAP" | "EDIT" | null;
  reason: string | null;
  createdAt: Date;
};

/**
 * Sessions as position logic should see them. Her plan can change any time
 * (unlike a course); a gap she approved under an earlier plan would point
 * somewhere else in the new order, so approvals recorded before the latest
 * change stop counting. The ayat themselves always stay memorized.
 */
export function forPosition<T extends SessionRow>(sessions: T[], planChangedAt: Date | null): T[] {
  if (!planChangedAt) return sessions;
  return sessions.map((s) => (s.createdAt < planChangedAt ? { ...s, situation: null } : s));
}
