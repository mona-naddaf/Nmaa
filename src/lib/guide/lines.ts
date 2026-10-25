// What the page-level guidance shows besides the help (review pages ٢, ٤, ٥):
// which welcome line «خطتي» has, the items of «الخطوات الأولى» and when they
// tick, which feature intro lines a page offers now, and what «إظهار
// الإرشادات من جديد» can truthfully promise. Pure: the pages pass her real
// data (counts read on the server while guidance is on), decideGuide then
// picks the one line a page shows.

import { INTRO_IDS, type GuidePage, type IntroId, type WelcomeId } from "./keys";
import type { GuideStates } from "./rules";
import type { HelpFeature } from "./help/types";

const has = (states: GuideStates, key: keyof GuideStates) => Object.hasOwn(states, key);

/**
 * «خطتي»'s welcome line: the empty plan of «أختار السور بنفسي» (she came from
 * the setup questions with ?from=start), the first setup, or the page's own
 * once a plan is saved.
 */
export function planWelcome({ hasPlan, fromStart }: { hasPlan: boolean; fromStart: boolean }): WelcomeId {
  if (hasPlan) return "plan";
  return fromStart ? "plan-custom" : "plan-setup";
}

/** The page's welcome line id (only «خطتي» has more than one). */
export function welcomeFor(page: GuidePage, plan: { hasPlan: boolean; fromStart: boolean }): WelcomeId {
  return page === "plan" ? planWelcome(plan) : page;
}

/** What «الخطوات الأولى» is ticked from: her own data. */
export type ChecklistFacts = { sessions: number; trackerItems: number; trackerChecks: number };

export type ChecklistItem =
  | { id: "session"; done: boolean }
  // while her tracker is empty: «أضيفي أول بندٍ…»; then «علّمي أول بندٍ…»
  | { id: "tracker"; done: boolean; add: boolean }
  | { id: "homelog"; done: boolean };

/**
 * The items, in order. Item 2 is left out after «لا، ليس الآن» to the
 * tracker question, until she adds an item herself (the same rule as
 * decideGuide's trackerItem).
 */
export function checklistItems(facts: ChecklistFacts, states: GuideStates): ChecklistItem[] {
  const tracker = !has(states, "checklist.noTracker") || facts.trackerItems > 0;
  const add = facts.trackerItems === 0;
  return [
    { id: "session", done: facts.sessions > 0 },
    ...(tracker ? [{ id: "tracker" as const, add, done: !add && facts.trackerChecks > 0 }] : []),
    { id: "homelog", done: has(states, "checklist.homelog") },
  ];
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

export function checklistComplete(facts: ChecklistFacts, states: GuideStates): boolean {
  return checklistItems(facts, states).every((i) => i.done);
}

/**
 * «إظهار الإرشادات من جديد» brings the checklist back only to a new account
 * whose list is hidden and not complete (M3); only then may its confirmation
 * name the checklist (Mona, 2026-10-25).
 */
export function checklistComesBack(isNew: boolean, states: GuideStates, complete: boolean): boolean {
  return isNew && has(states, "checklist.hidden") && !complete;
}

/** What an intro line's condition is read from. */
export type IntroFacts = {
  features: Record<HelpFeature, boolean>;
  city: boolean;
  // «صفحتي»
  flaggerOpen?: boolean;
  // a word flagged in any of her sessions, ever
  flaggedWords?: boolean;
  completedSurah?: boolean;
  sessions?: number;
  goal?: boolean;
  // «جدول المتابعة»: current items, and whole days since the oldest of them was added
  trackerItems?: number;
  trackerDays?: number;
};

/** The feature each intro line switches on («تفعيل»); the others link somewhere or are a tip. */
export const INTRO_FEATURE: Partial<Record<IntroId, HelpFeature>> = {
  mutashabihat: "similar",
  tajweed: "tajweed",
  agenda: "agenda",
  summary: "summary",
  review: "review",
};

/**
 * The intro lines whose conditions hold on this page now (review page ٥), in
 * the order a page offers them; decideGuide shows the first not dismissed.
 * «صفحتي»'s two flagger lines count only while the flagger is open, where
 * they show.
 */
export function introsFor(page: GuidePage, f: IntroFacts): IntroId[] {
  const on: Partial<Record<IntroId, boolean>> = {};
  if (page === "home") {
    on.mutashabihat = f.flaggerOpen === true && !f.features.similar;
    on.tajweed = f.flaggerOpen === true && !f.features.tajweed && f.flaggedWords === true;
    on.review = !f.features.review && f.completedSurah === true;
    on.goal = (f.sessions ?? 0) >= 3 && f.goal === false;
  } else if (page === "segment") {
    on.mutashabihat = !f.features.similar;
    on.verseNotes = true;
  } else if (page === "tracker") {
    const items = f.trackerItems ?? 0;
    on.agenda = !f.features.agenda && items >= 2;
    on.summary = !f.features.summary && items > 0 && (f.trackerDays ?? 0) >= 7;
    on.city = f.features.agenda && !f.city;
  }
  return INTRO_IDS.filter((id) => on[id] === true);
}
