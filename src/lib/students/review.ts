import { AYAH_COUNT } from "@/lib/quran-data";
import { advancesPosition, type SessionType } from "@/lib/recitation/logic";

// Review reminders, derived from the session log on every load (nothing is
// stored per surah, so backdated sessions, plan edits and setting changes
// can't leave it stale).
//
// A surah counts once it's COMPLETED: every ayah covered by NEW sessions
// (PRIOR baselines included — their date is the day she joined). From then
// on each ayah's clock is its latest REVIEW/LINK session, or the completion
// date if it hasn't been reviewed since. The surah's clock is its OLDEST
// ayah, so reviewing one page of a long surah doesn't clear the whole thing.

export interface ReviewSession {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  type: SessionType;
  occurredAt: Date;
}

export interface OverdueSurah {
  surahNumber: number;
  // YYYY-MM-DD the oldest part was last reviewed, or completed if never since
  since: string;
  // true when some ayah hasn't been reviewed at all since the surah was completed
  neverReviewed: boolean;
  daysSince: number;
}

// pre-filled when a supervisor turns reminders on (off by default)
export const DEFAULT_REVIEW_REMINDER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (d: Date) => Math.floor(d.getTime() / DAY_MS);

/** Surahs overdue for review, oldest first. Empty when reminders are off. */
export function computeOverdueSurahs(
  sessions: ReviewSession[],
  reviewDays: number | null,
  today: Date,
): OverdueSurah[] {
  if (!reviewDays || reviewDays < 1) return [];

  // per surah, per ayah (index ayah-1): earliest NEW day, latest REVIEW/LINK day
  const firstNew = new Map<number, Float64Array>();
  const lastReview = new Map<number, Float64Array>();
  const arrayFor = (map: Map<number, Float64Array>, surah: number, fill: number) => {
    let arr = map.get(surah);
    if (!arr) {
      arr = new Float64Array(AYAH_COUNT[surah]).fill(fill);
      map.set(surah, arr);
    }
    return arr;
  };

  for (const s of sessions) {
    const count = AYAH_COUNT[s.surahNumber];
    if (!count) continue;
    const day = dayNumber(s.occurredAt);
    const from = Math.max(1, s.fromAyah);
    const to = Math.min(count, s.toAyah);
    if (advancesPosition(s)) {
      const arr = arrayFor(firstNew, s.surahNumber, Infinity);
      for (let a = from; a <= to; a++) if (day < arr[a - 1]) arr[a - 1] = day;
    } else {
      const arr = arrayFor(lastReview, s.surahNumber, -Infinity);
      for (let a = from; a <= to; a++) if (day > arr[a - 1]) arr[a - 1] = day;
    }
  }

  const todayNum = dayNumber(today);
  const overdue: OverdueSurah[] = [];

  for (const [surah, newDays] of firstNew) {
    // completed on the day its last uncovered ayah was first memorized
    let completedDay = -Infinity;
    for (const d of newDays) {
      if (d === Infinity) {
        completedDay = Infinity; // an ayah was never memorized: not complete
        break;
      }
      if (d > completedDay) completedDay = d;
    }
    if (completedDay === Infinity) continue;

    const reviews = lastReview.get(surah);
    let oldest = Infinity;
    let neverReviewed = false;
    for (let i = 0; i < newDays.length; i++) {
      const reviewed = reviews ? reviews[i] : -Infinity;
      if (reviewed <= completedDay) neverReviewed = true;
      const effective = Math.max(completedDay, reviewed);
      if (effective < oldest) oldest = effective;
    }

    const daysSince = todayNum - oldest;
    if (daysSince > reviewDays) {
      overdue.push({
        surahNumber: surah,
        since: new Date(oldest * DAY_MS).toISOString().slice(0, 10),
        neverReviewed,
        daysSince,
      });
    }
  }

  return overdue.sort((a, b) => b.daysSince - a.daysSince || a.surahNumber - b.surahNumber);
}
