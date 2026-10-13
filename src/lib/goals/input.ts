import { addDays, isValidIso } from "@/lib/calendar/hijri";
import { targetEnd, targetStretch, type GoalSession, type GoalTarget, type GoalTargetKind } from "./goal";
import { advancesPosition } from "@/lib/recitation/logic";

// Checking a goal sent from the form (course and «رفيق الحفظ» alike): a
// target that lies in her current plan, not memorized in full already, and
// a deadline from today up to ten years ahead.

export const GOAL_KINDS: GoalTargetKind[] = ["PLAN", "JUZ", "POINT"];
const MAX_DAYS_AHEAD = 3650;

export interface GoalInput {
  target: GoalTargetKind;
  juz?: number | null;
  surah?: number | null;
  ayah?: number | null;
  deadline: string;
}

const intOrNull = (v: unknown) => (Number.isInteger(Number(v)) && v !== null && v !== "" ? Number(v) : null);

export function parseGoalInput(
  raw: unknown,
  plan: number[],
  sessions: Pick<GoalSession, "surahNumber" | "fromAyah" | "toAyah" | "type">[],
  today: string,
): { error: string } | { target: GoalTarget; deadline: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kind = String(r.target) as GoalTargetKind;
  if (!GOAL_KINDS.includes(kind)) return { error: "نوع الهدف غير صحيح" };
  const target: GoalTarget = {
    target: kind,
    juz: kind === "JUZ" ? intOrNull(r.juz) : null,
    surah: kind === "POINT" ? intOrNull(r.surah) : null,
    ayah: kind === "POINT" ? intOrNull(r.ayah) : null,
  };
  if (kind === "JUZ" && (target.juz === null || target.juz < 1 || target.juz > 30)) return { error: "يُرجى اختيار الجزء" };
  if (!targetEnd(plan, target)) return { error: "هذا الهدف ليس ضمن الخطة الحالية" };

  const deadline = String(r.deadline ?? "");
  if (!isValidIso(deadline)) return { error: "يُرجى اختيار موعد صحيح" };
  if (deadline < today) return { error: "لا يمكن أن يكون الموعد في الماضي" };
  if (deadline > addDays(today, MAX_DAYS_AHEAD)) return { error: "يُرجى اختيار موعد لا يتجاوز عشر سنوات" };

  // already memorized in full: nothing to aim for
  const covered = new Map<number, Set<number>>();
  for (const s of sessions) {
    if (!advancesPosition(s)) continue;
    const set = covered.get(s.surahNumber) ?? new Set<number>();
    for (let a = s.fromAyah; a <= s.toAyah; a++) set.add(a);
    covered.set(s.surahNumber, set);
  }
  const allDone = targetStretch(plan, target)!.every((seg) => {
    for (let a = seg.fromAyah; a <= seg.toAyah; a++) if (!covered.get(seg.surahNumber)?.has(a)) return false;
    return true;
  });
  if (allDone) return { error: "هذا الهدف محفوظ بالكامل بالفعل" };

  return { target, deadline };
}

/** Same target as the stored goal: a deadline-only change keeps its start day. */
export function sameTarget(a: GoalTarget, b: GoalTarget): boolean {
  return a.target === b.target && a.juz === b.juz && a.surah === b.surah && a.ayah === b.ayah;
}
