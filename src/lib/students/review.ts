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
}

/** A completed surah's review clock (reviewAges). */
export interface ReviewAge {
  surahNumber: number;
  // YYYY-MM-DD the oldest part was last reviewed, or completed if never since
  since: string;
  // true when some ayah hasn't been reviewed at all since the surah was completed
  neverReviewed: boolean;
}

export interface OverdueSurah extends ReviewAge {
  daysSince: number;
}

// pre-filled when a supervisor turns reminders on (off by default)
export const DEFAULT_REVIEW_REMINDER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/**
 * Every completed surah with the day its oldest part was last reviewed.
 * dayOf: the day a session happened — a course's are read in its time zone
 * (lib/time/zone.ts), «رفيق الحفظ» uses the day she logged it on.
 */
export function reviewAges<S extends ReviewSession>(sessions: S[], dayOf: (s: S) => string): ReviewAge[] {
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
    const day = dayNumber(dayOf(s));
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

  const ages: ReviewAge[] = [];
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
    ages.push({ surahNumber: surah, since: new Date(oldest * DAY_MS).toISOString().slice(0, 10), neverReviewed });
  }
  return ages;
}

/** The ones overdue on `today` ("YYYY-MM-DD"), oldest first. Empty when reminders are off. */
export function overdueFrom(ages: ReviewAge[], reviewDays: number | null, today: string): OverdueSurah[] {
  if (!reviewDays || reviewDays < 1) return [];
  const todayNum = dayNumber(today);
  return ages
    .map((a) => ({ ...a, daysSince: todayNum - dayNumber(a.since) }))
    .filter((a) => a.daysSince > reviewDays)
    .sort((a, b) => b.daysSince - a.daysSince || a.surahNumber - b.surahNumber);
}

/** Surahs overdue for review on `today`, oldest first. Empty when reminders are off. */
export function computeOverdueSurahs<S extends ReviewSession>(
  sessions: S[],
  reviewDays: number | null,
  today: string,
  dayOf: (s: S) => string,
): OverdueSurah[] {
  if (!reviewDays || reviewDays < 1) return [];
  return overdueFrom(reviewAges(sessions, dayOf), reviewDays, today);
}
