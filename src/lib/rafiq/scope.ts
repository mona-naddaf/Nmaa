// Who is looking at a «رفيق الحفظ» page and whose data it is — what the
// shared components (RafiqHome, RafiqTracker) need to show the same page to
// the learner herself, to a child («العائلة», /family) or to an adult of the
// child's family (/rafiq/family/[id]/child/[childId]). What the server
// allows is decided separately, from the database, in subject.ts; this only
// decides what's shown.

export type RafiqViewer =
  // her own Rafiq page: everything exactly as before «العائلة»
  | "self"
  // a child on her own page (/family)
  | "child"
  // an adult on a child's page, with edit rights / view only
  | "adult-edit"
  | "adult-view";

export type PersonRef = { name: string; gender: "MALE" | "FEMALE" };

export type RafiqScope = {
  viewer: RafiqViewer;
  // the child's id on an adult's page (passed to every action)
  subjectId?: string;
  // whose page it is (adult views): wording about her, «سجّلها {الاسم}»
  child?: PersonRef;
  // the adult looking (adult views): «سجّلتِها» for her own sessions
  viewerId?: string;
  // the family's adults by id, for «مع {الاسم}» / «سجّلها {الاسم}»
  adults?: Record<string, PersonRef>;
  // the child's switches that change these pages (step 4): her streak card
  streak?: boolean;
  // where «أيام الالتزام» is set (an adult's view of the child's settings)
  settingsHref?: string;
};

export const SELF_SCOPE: RafiqScope = { viewer: "self" };

const adultViewer = (s: RafiqScope) => s.viewer === "adult-edit" || s.viewer === "adult-view";

export const scopeCan = (s: RafiqScope) => ({
  // record sessions and work on the tracker
  record: s.viewer !== "adult-view",
  // the full form with word-by-word mistakes («التسميع مع الطفل»)
  markWords: s.viewer === "self" || s.viewer === "adult-edit",
  // «أتقنتُها» on the words-to-review list
  resolve: s.viewer === "self" || s.viewer === "adult-edit",
  // change a child's assessment
  assess: s.viewer === "adult-edit",
  // what only her own Rafiq page has: streak, goal, notes, summaries, the template bank
  ownExtras: s.viewer === "self",
  aboutChild: adultViewer(s),
});

/** A session she may delete: everything on her own page; a child only what she recorded herself. */
export function canDeleteSession(s: RafiqScope, h: { recordedByAdult: boolean }): boolean {
  if (s.viewer === "self" || s.viewer === "adult-edit") return true;
  if (s.viewer === "child") return !h.recordedByAdult;
  return false;
}

const by = (g: "MALE" | "FEMALE", m: string, f: string) => (g === "FEMALE" ? f : m);

/**
 * «العائلة»: who recorded a session, in one short line — null on her own Rafiq
 * page and for previous memorization. you: the viewer's own gender.
 */
export function recordedByLine(
  s: RafiqScope,
  h: { source: "LOGGED" | "PRIOR"; recordedByAdult: boolean; recordedById: string | null },
  you: "MALE" | "FEMALE" | null,
): string | null {
  if (s.viewer === "self" || h.source !== "LOGGED") return null;
  const adult = h.recordedById ? s.adults?.[h.recordedById] : undefined;
  if (s.viewer === "child") {
    if (!h.recordedByAdult) return you === "FEMALE" ? "سجّلتِها" : "سجّلتَها";
    return adult ? `مع ${adult.name}` : "مع أحد البالغين";
  }
  if (!h.recordedByAdult) return s.child ? by(s.child.gender, `سجّلها ${s.child.name}`, `سجّلتها ${s.child.name}`) : null;
  if (h.recordedById && h.recordedById === s.viewerId) return you === "FEMALE" ? "سجّلتِها" : "سجّلتَها";
  return adult ? by(adult.gender, `سجّلها ${adult.name}`, `سجّلتها ${adult.name}`) : "سجّلها أحد البالغين";
}

/** The child's own assessment (set when she recorded it herself, untouched by adults), shown as «تقييم ذاتي». */
export function selfAssessed(s: RafiqScope, h: { quality: unknown; recordedByAdult: boolean; qualityByAdult: boolean }): boolean {
  return s.viewer !== "self" && !!h.quality && !h.recordedByAdult && !h.qualityByAdult;
}
