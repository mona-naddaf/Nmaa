// The only GuideState keys there are (prisma: GuideState), and which of them
// the page may set itself. Pure: shared by the server actions, which refuse
// anything else, and the provider.
//
//   wizard.step        where to resume the setup questions: { q: 1–5 }
//   wizard.done        the setup questions were finished
//   wizard.deferred    signed up from a «العائلة» invite: no automatic wizard,
//                      the resume card instead ({ via: "family" }; set at signup)
//   wizard.rerun       «إعادة أسئلة البداية» from the settings (set by the reset)
//   wizard.cardHidden  «إخفاء» on the resume card in «صفحتي»
//   checklist.hidden      «إخفاء القائمة»
//   checklist.celebrated  the «أحسنتِ، بدأتِ على مُكث» line was shown once
//   checklist.noTracker   «لا، ليس الآن» to the tracker question: item 2 hidden
//   hints.restored     «إظهار الإرشادات من جديد»: welcome lines show again,
//                      for existing accounts too (set by the reset)
//   welcome.<page>     «فهمت» on that page's welcome line
//   intro.<feature>    «تفعيل» or «×» on that feature's intro line

/** The pages that have help, a welcome line or both («العائلة» pages have none). */
export const GUIDE_PAGES = [
  "home",
  "plan",
  "homelog",
  "segment",
  "tracker",
  "summary",
  "templates",
  "calendar",
  "notes",
  "verse",
  "settings",
] as const;
export type GuidePage = (typeof GUIDE_PAGES)[number];

/**
 * Welcome lines: one per page, and «خطتي» has two more for its first setup
 * (from scratch, and the empty plan of «أختار السور بنفسي»), dismissed apart.
 */
export const WELCOME_IDS = [...GUIDE_PAGES, "plan-setup", "plan-custom"] as const;
export type WelcomeId = (typeof WELCOME_IDS)[number];

/** Feature intro lines (review page ٥), in the order a page offers them. */
export const INTRO_IDS = ["mutashabihat", "tajweed", "agenda", "summary", "review", "city", "verseNotes", "goal"] as const;
export type IntroId = (typeof INTRO_IDS)[number];

/** Setup questions: 1 plan, 2 prior, 3 commitment days, 4 tracker (4a–4c), 5 review. */
export const WIZARD_QUESTIONS = 5;

const FIXED = [
  "wizard.step",
  "wizard.done",
  "wizard.deferred",
  "wizard.rerun",
  "wizard.cardHidden",
  "checklist.hidden",
  "checklist.celebrated",
  "checklist.noTracker",
  "hints.restored",
] as const;

export type GuideKey = (typeof FIXED)[number] | `welcome.${WelcomeId}` | `intro.${IntroId}`;

export const GUIDE_KEYS: readonly GuideKey[] = [
  ...FIXED,
  ...WELCOME_IDS.map((w) => `welcome.${w}` as const),
  ...INTRO_IDS.map((i) => `intro.${i}` as const),
];

const KEY_SET = new Set<string>(GUIDE_KEYS);

// set only by the server itself (signup, the two resets), never by the page
const SERVER_ONLY = new Set<string>(["wizard.deferred", "wizard.rerun", "hints.restored"]);

export function isGuideKey(raw: unknown): raw is GuideKey {
  return typeof raw === "string" && KEY_SET.has(raw);
}

/** A key the page may set through markGuide (everything but the server's own). */
export function isClientKey(raw: unknown): raw is GuideKey {
  return isGuideKey(raw) && !SERVER_ONLY.has(raw);
}

export type GuideValue = { q: number } | { via: "family" } | null;

/**
 * The value stored with a key, checked: wizard.step needs { q: 1–5 } (nothing
 * else is kept), wizard.deferred { via: "family" }, every other key none.
 * undefined = refused.
 */
export function checkGuideValue(key: GuideKey, raw: unknown): GuideValue | undefined {
  if (key === "wizard.step") {
    const q = (raw as { q?: unknown } | null)?.q;
    return typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= WIZARD_QUESTIONS ? { q } : undefined;
  }
  if (key === "wizard.deferred") return (raw as { via?: unknown } | null)?.via === "family" ? { via: "family" } : undefined;
  return raw === null || raw === undefined ? null : undefined;
}
