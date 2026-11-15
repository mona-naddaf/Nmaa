// The guide's state for «العائلة» (FAMILY_GUIDE_EMAILS), in the same GuideState
// table, apart from Rafiq's own keys (keys.ts): Rafiq's provider never reads
// these, and Rafiq's markGuideAction refuses them. Pure.
//
// On a child's row (she is a RafiqUser too):
//   child.welcome.<page>  «فهمت» on that page's welcome line, by the child herself
//   childStart.step       where to resume her start questions: { q: 1–4 }
//   childStart.done       the start questions were finished
//   childStart.cardHidden «إخفاء» on the card that offers the rest of them
// (her guideNewAt, set when she was added while the guide reached the family,
// is what makes her «new»: the start questions and the welcome lines)
//
// On an adult's row:
//   family.joined    she joined this family with an invite: { f: familyId } (set by the server)
//   family.welcomed  «فهمت» on that family's welcome card: { f: familyId }

/** The child's pages that have a welcome line and help. */
export const CHILD_GUIDE_PAGES = ["home", "plan", "tracker", "summary", "homelog", "segment", "family", "calendar"] as const;
export type ChildGuidePage = (typeof CHILD_GUIDE_PAGES)[number];

/** The start questions: 1 plan, 2 prior, 3 tracker, 4 features. */
export const CHILD_START_QUESTIONS = 4;

export type ChildKey = `child.welcome.${ChildGuidePage}` | "childStart.step" | "childStart.done" | "childStart.cardHidden";
export type JoinKey = "family.joined" | "family.welcomed";
export type FamilyGuideKey = ChildKey | JoinKey;

const CHILD_KEYS = new Set<string>([...CHILD_GUIDE_PAGES.map((p) => `child.welcome.${p}`), "childStart.step", "childStart.done", "childStart.cardHidden"]);
const JOIN_KEYS = new Set<string>(["family.joined", "family.welcomed"]);

export const isChildKey = (raw: unknown): raw is ChildKey => typeof raw === "string" && CHILD_KEYS.has(raw);
export const isJoinKey = (raw: unknown): raw is JoinKey => typeof raw === "string" && JOIN_KEYS.has(raw);

/** A welcome key the child may set herself (and nothing else). */
export const isChildWelcomeKey = (raw: unknown): raw is `child.welcome.${ChildGuidePage}` => isChildKey(raw) && raw.startsWith("child.welcome.");

/** A start-questions key an adult with edit rights may set on the child's row. */
export const isChildStartKey = (raw: unknown): raw is "childStart.step" | "childStart.done" | "childStart.cardHidden" => isChildKey(raw) && raw.startsWith("childStart.");

export type FamilyGuideValue = { q: number } | { f: string } | null;
export type FamilyGuideStates = Partial<Record<FamilyGuideKey, FamilyGuideValue>>;

/** The value kept with a key, checked; undefined = refused. */
export function checkFamilyGuideValue(key: FamilyGuideKey, raw: unknown): FamilyGuideValue | undefined {
  if (key === "childStart.step") {
    const q = (raw as { q?: unknown } | null)?.q;
    return typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= CHILD_START_QUESTIONS ? { q } : undefined;
  }
  if (key === "family.joined" || key === "family.welcomed") {
    const f = (raw as { f?: unknown } | null)?.f;
    return typeof f === "string" && f.length > 0 && f.length <= 64 ? { f } : undefined;
  }
  return raw === null || raw === undefined ? null : undefined;
}

/** Stored rows → states, leaving out what the code doesn't know. */
export function toFamilyStates(rows: { key: string; value: unknown }[]): FamilyGuideStates {
  const states: FamilyGuideStates = {};
  for (const r of rows) {
    if (!isChildKey(r.key) && !isJoinKey(r.key)) continue;
    const v = checkFamilyGuideValue(r.key, r.value);
    if (v !== undefined) states[r.key] = v;
  }
  return states;
}

/** The step a resume lands on, from childStart.step (null: the first screen). */
export const startStep = (states: FamilyGuideStates): number | null => {
  const v = states["childStart.step"];
  return v && "q" in v ? v.q : null;
};

/** Whether the join card shows on this family's page: she joined it, and hasn't pressed «فهمت» there. */
export function joinCardShows(states: FamilyGuideStates, familyId: string): boolean {
  const joined = states["family.joined"];
  const welcomed = states["family.welcomed"];
  return !!joined && "f" in joined && joined.f === familyId && !(welcomed && "f" in welcomed && welcomed.f === familyId);
}

/** «بقي سؤالان…»: questions not reached yet (the one she stopped at counts as left). */
export function startQuestionsLeft(states: FamilyGuideStates): number {
  const at = startStep(states) ?? 1;
  return Math.max(1, CHILD_START_QUESTIONS - at + 1);
}
