// The setup questions at /rafiq/start (review page ١): which screen comes
// next, where a resume lands, the review-reminder choices and the closing
// summary. Pure, so every path is unit-tested (wizard.test.ts); the page
// keeps the answers and does the saving.
//
//   welcome → q1 plan → q2 prior → q3 commitment days → q4 tracker
//   (4a ready-made or empty, 4b with times?, 4c prayer times or hours)
//   → q5 review reminder → done

import { WIZARD_QUESTIONS } from "./keys";

export type Screen = "welcome" | "q1" | "q2" | "q3" | "q4" | "q4a" | "q4b" | "q4c" | "q5" | "done";

/** What the order depends on, from her real data. */
export type WizardFacts = {
  // a plan is saved (Q2 needs one: its prior memorization is a range of the plan)
  hasPlan: boolean;
  // templates in the bank (none: no «أختار جدولًا جاهزًا», straight to 4b)
  bankCount: number;
};

// what she chose on the screen that decides the branch
export type Branch = { tracker?: "yes" | "no"; withTimes?: "yes" | "no" };

/** The question number shown in «السؤال n من 5» (4a–4c are all 4); null on the welcome and last screens. */
export function questionOf(screen: Screen): number | null {
  if (screen === "welcome" || screen === "done") return null;
  return Number(screen[1]);
}

/** The screen after this one, once its answer is saved or skipped. */
export function nextScreen(screen: Screen, facts: WizardFacts, branch: Branch = {}): Screen {
  switch (screen) {
    case "welcome":
      return "q1";
    case "q1":
      // no plan (skipped, or «أختار السور بنفسي»): the prior question goes too
      return facts.hasPlan ? "q2" : "q3";
    case "q2":
      return "q3";
    case "q3":
      return "q4";
    case "q4":
      return branch.tracker === "yes" ? (facts.bankCount > 0 ? "q4a" : "q4b") : "q5";
    case "q4a":
      return "q4b";
    case "q4b":
      return branch.withTimes === "yes" ? "q4c" : "q5";
    case "q4c":
      return "q5";
    case "q5":
    case "done":
      return "done";
  }
}

/**
 * «السابق» when the page opened part-way (a resume) and has no screens behind
 * it yet: the screen that would have come before. With a history, the page
 * goes back along it instead.
 */
export function prevScreen(screen: Screen, facts: WizardFacts): Screen {
  switch (screen) {
    case "welcome":
    case "q1":
      return "welcome";
    case "q2":
      return "q1";
    case "q3":
      return facts.hasPlan ? "q2" : "q1";
    case "q4":
      return "q3";
    case "q4a":
      return "q4";
    case "q4b":
      return facts.bankCount > 0 ? "q4a" : "q4";
    case "q4c":
      return "q4b";
    case "q5":
      return "q4";
    case "done":
      return "q5";
  }
}

/**
 * Where she lands when the page opens: the last screen once finished, the
 * question she stopped at (from wizard.step), or the welcome screen.
 */
export function landing({ done, step, facts }: { done: boolean; step: number | null; facts: WizardFacts }): Screen {
  if (done) return "done";
  if (step === null || step < 1) return "welcome";
  const q = Math.min(step, WIZARD_QUESTIONS);
  if (q === 2 && !facts.hasPlan) return "q3";
  return `q${q}` as Screen;
}

export const REVIEW_PRESETS = [7, 14, 30] as const;
// preselected when reminders are off
export const REVIEW_DEFAULT = 14;

/**
 * The review-reminder choices: a week, two weeks, a month, and her current
 * number of days as one more when it is none of them (reminders already on).
 */
export function reviewChoices(current: number | null): number[] {
  const list: number[] = [...REVIEW_PRESETS];
  if (current !== null && !list.includes(current)) list.push(current);
  return list.sort((a, b) => a - b);
}

/** «كل 10 أيام»: her current number of days, when it isn't a preset. */
export function everyDaysLabel(n: number): string {
  if (n === 1) return "كل يوم";
  if (n === 2) return "كل يومين";
  return n <= 10 ? `كل ${n} أيام` : `كل ${n} يومًا`;
}

/** Labels of the three presets (review page ١, Western digits). */
export function presetLabel(n: number): string {
  if (n === 7) return "أسبوع (7 أيام)";
  if (n === 14) return "أسبوعان (14 يومًا)";
  if (n === 30) return "شهر (30 يومًا)";
  return everyDaysLabel(n);
}

/** Questions answered so far → «بقيت لكِ {3 أسئلة}». */
export function questionsLeft(n: number): string {
  if (n === 1) return "سؤال واحد";
  if (n === 2) return "سؤالان";
  return n <= 10 ? `${n} أسئلة` : `${n} سؤالًا`;
}
