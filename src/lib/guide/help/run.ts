import type { HelpCond, HelpFacts, HelpQuestion, HelpStep } from "./types";

// The rules of the help panel and of «أرِني», apart from the page: which
// questions show, which steps a tour has for her, what a step shows when its
// element is or isn't there, and what pressing does. Pure; the panel and the
// tour (src/components/guide) only follow these answers.

/** At most this many questions are listed; the rest go under «أسئلة أخرى». */
export const MAX_VISIBLE = 5;

export function splitQuestions<Q extends { more?: boolean }>(questions: Q[]): { visible: Q[]; more: Q[] } {
  const first = questions.filter((q) => !q.more);
  return { visible: first.slice(0, MAX_VISIBLE), more: [...first.slice(MAX_VISIBLE), ...questions.filter((q) => q.more)] };
}

export function holds(cond: HelpCond, facts: HelpFacts): boolean {
  switch (cond) {
    case "agenda":
      return facts.features.agenda;
    case "founder":
      return facts.founder;
    case "noPlan":
      return !facts.plan;
  }
}

/** Her steps for a question: the ones that don't apply left out, alternatives in their place. */
export function stepsFor<T extends string, P extends string>(q: HelpQuestion<T, P>, facts: HelpFacts): HelpStep<T, P>[] {
  return q.steps
    .filter((s) => !s.when || holds(s.when, facts))
    .map((s) => {
      if (!s.alt || !holds(s.alt.when, facts)) return s;
      const { alt, ...rest } = s;
      return { ...rest, text: alt.text, target: alt.target ?? s.target };
    });
}

/**
 * What a step shows:
 * - show: its element, lit
 * - plain: the sentence alone (a step with no element keeps the last one lit)
 * - away: «هذه الخطوة في صفحة …» with a link there
 * - offer: «تفعيل الآن» for the feature it needs
 * - city: «الذهاب إلى الإعدادات» (a city is picked from a list, not switched on)
 * - blocked: the limit message is on the page; the step says why it can't be done
 * - missing: «هذا الجزء غير موجود بعد» (also for a page with no fixed address)
 */
export type StepView = "show" | "plain" | "away" | "offer" | "city" | "blocked" | "missing";

export type StepContext<P extends string> = {
  // the page she is on, and the page the step's question belongs to
  here: P | null;
  home: P;
  // whether its element is on the page, and its `blocked` element
  found: boolean;
  blocked: boolean;
  facts: HelpFacts;
  // where a page is (null: no fixed address, like one verse's page)
  hrefOf: (page: P) => string | null;
};

export function stepView<T extends string, P extends string>(step: HelpStep<T, P>, ctx: StepContext<P>): StepView {
  const page = step.page ?? ctx.home;
  if (page !== ctx.here) return ctx.hrefOf(page) === null ? "missing" : "away";
  if (step.blocked && ctx.blocked) return "blocked";
  if (!step.target) return "plain";
  if (ctx.found) return "show";
  if (step.needs === "city") return ctx.facts.city ? "missing" : "city";
  if (step.needs && !ctx.facts.features[step.needs]) return "offer";
  return "missing";
}

/**
 * What pressing the lit element does to the tour (Mona, 2026-10-24): only a
 * button that opens something moves it on. A field or a section stays hers to
 * use, and a save button is pressed by her alone, so neither moves the tour.
 */
export function onPress(step: Pick<HelpStep, "kind">): "next" | "then" | "stay" {
  const kind = step.kind ?? "look";
  return kind === "press" ? "next" : kind === "leave" ? "then" : "stay";
}

/** Whether «التالي» presses the lit element for her: only one that opens something, never one that saves. */
export function nextPresses(step: Pick<HelpStep, "kind">): boolean {
  return (step.kind ?? "look") === "press";
}

/** «2 من 4» */
export const progressLabel = (index: number, count: number) => `${index + 1} من ${count}`;
