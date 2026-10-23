// What the guidance shows a Rafiq account, decided from her guide state — the
// pure rules behind the provider, the setup questions and the settings card,
// with no DB and no cookies, so every case is unit-tested (rules.test.ts).
//
// New account = guideNewAt set at signup while guidance was on. null = an
// account from before (or created while it was off): already onboarded, so no
// setup questions, no «الخطوات الأولى», no welcome lines — only intro lines,
// and, after «إظهار الإرشادات من جديد», the welcome lines once more. A child
// («العائلة») never gets any of it.

import { GUIDE_KEYS, WIZARD_QUESTIONS, type GuideKey, type GuidePage, type GuideValue, type IntroId, type WelcomeId } from "./keys";

/** Her GuideState rows: a key is there when its row exists. */
export type GuideStates = Partial<Record<GuideKey, GuideValue>>;

export type GuideInput = {
  // guideEnabled()
  on: boolean;
  kind: "ADULT" | "CHILD";
  // guideNewAt !== null
  isNew: boolean;
  states: GuideStates;
  // the page asking («العائلة» pages: none)
  page?: GuidePage | null;
  // which of the page's welcome lines it would show (default: the page's own)
  welcome?: WelcomeId;
  // the intro lines whose conditions hold on this page now, in its order
  intros?: readonly IntroId[];
  // «الخطوات الأولى»: all of its items done (from her real data)
  checklistComplete?: boolean;
  // she has a tracker item (item 2 comes back after «لا، ليس الآن»)
  hasTrackerItems?: boolean;
};

export type GuideDecision = {
  wizard: {
    // after the recovery-code screen, continue to the setup questions
    startAfterSignup: boolean;
    // the resume card in «صفحتي»: how many questions are left
    card: { remaining: number } | null;
    // a re-run from the settings: the plan question is a link to «خطتي» only
    mode: "first" | "rerun";
  };
  checklist: { show: boolean; trackerItem: boolean; celebrate: boolean };
  welcome: WelcomeId | null;
  intro: IntroId | null;
};

const NOTHING: GuideDecision = {
  wizard: { startAfterSignup: false, card: null, mode: "first" },
  checklist: { show: false, trackerItem: false, celebrate: false },
  welcome: null,
  intro: null,
};

export function decideGuide(input: GuideInput): GuideDecision {
  if (!input.on || input.kind !== "ADULT") return NOTHING;
  const has = (k: GuideKey) => Object.hasOwn(input.states, k);
  const { isNew } = input;

  const done = has("wizard.done");
  const rerun = has("wizard.rerun");
  const step = input.states["wizard.step"];
  const answered = step && "q" in step ? step.q - 1 : 0;
  const cardOpen = (isNew || rerun) && !done && !has("wizard.cardHidden");

  const hidden = has("checklist.hidden");
  const complete = input.checklistComplete === true;

  // welcome lines: a new account's, or anyone's after «إظهار الإرشادات من جديد»
  const welcomeId = input.page ? (input.welcome ?? input.page) : null;
  const welcome = welcomeId && (isNew || has("hints.restored")) && !has(`welcome.${welcomeId}`) ? welcomeId : null;

  // at most one intro line on a page: the first one still not dismissed
  const intro = input.page ? ((input.intros ?? []).find((i) => !has(`intro.${i}`)) ?? null) : null;

  return {
    wizard: {
      startAfterSignup: isNew && !done && !has("wizard.deferred"),
      card: cardOpen ? { remaining: Math.max(1, WIZARD_QUESTIONS - answered) } : null,
      mode: rerun ? "rerun" : "first",
    },
    checklist: {
      // a new account's only: the reset never brings it back to an existing one
      show: isNew && !hidden && !complete,
      trackerItem: !has("checklist.noTracker") || input.hasTrackerItems === true,
      celebrate: isNew && complete && !hidden && !has("checklist.celebrated"),
    },
    welcome,
    intro,
  };
}

/**
 * A new account's guide state, from the signup form: marked new only while
 * guidance is on; next = safeNext(...) of a «العائلة» invite (or null), which
 * defers the setup questions to the resume card.
 */
export function guideAtSignup(on: boolean, next: string | null): { isNew: boolean; deferred: boolean } {
  return on ? { isNew: true, deferred: next !== null } : { isNew: false, deferred: false };
}

export type GuideReset = "wizard" | "hints";

/**
 * The two settings buttons: which rows go, and the marker row that stays.
 * - «إعادة أسئلة البداية»: the setup questions' progress (and a «العائلة»
 *   deferral) go; wizard.rerun marks the re-run.
 * - «إظهار الإرشادات من جديد»: dismissed welcome and intro lines and a hidden
 *   checklist go; hints.restored brings the welcome lines back for everyone.
 *   A finished checklist stays finished.
 */
export function resetFor(kind: GuideReset): { remove: GuideKey[]; set: GuideKey } {
  if (kind === "wizard") {
    return { remove: ["wizard.step", "wizard.done", "wizard.cardHidden", "wizard.deferred"], set: "wizard.rerun" };
  }
  return {
    remove: GUIDE_KEYS.filter((k) => k.startsWith("welcome.") || k.startsWith("intro.") || k === "checklist.hidden"),
    set: "hints.restored",
  };
}
