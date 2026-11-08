import type { EnableFeature, HelpCond, HelpFacts, HelpQuestion, HelpStep } from "./types";

// The rules of the help panel and of «أرِني», apart from the page: which
// questions show, which steps a tour has for her, what a step shows when its
// element is or isn't there, and what pressing does. Pure; the panel and the
// tour (src/components/guide) only follow these answers.

/** A press on the page that didn't move: a scroll or a drag is no tap. */
export const isTap = (down: { x: number; y: number }, up: { x: number; y: number }) => Math.hypot(up.x - down.x, up.y - down.y) <= 10;

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
    case "highlight":
      return facts.highlight === true;
  }
}

/** A page's questions for her: the ones whose condition holds. */
export const questionsFor = <Q extends { when?: HelpCond }>(questions: Q[], facts: HelpFacts): Q[] => questions.filter((q) => !q.when || holds(q.when, facts));

const featureOn = (f: EnableFeature, facts: HelpFacts) => (f === "excuse" ? facts.excuse === true : facts.features[f]);

/** What a question's body shows in the panel: its steps, or the offer while its feature is off. */
export function panelShows(q: Pick<HelpQuestion, "offer">, facts: HelpFacts): "steps" | "offer" {
  return q.offer && !featureOn(q.offer.feature, facts) ? "offer" : "steps";
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

/** One question's tour: its steps for her, and its name for the bubble's dialog (the question's own text). */
export function tourFor<T extends string, P extends string>(q: HelpQuestion<T, P>, facts: HelpFacts): { title: string; steps: HelpStep<T, P>[] } {
  return { title: q.q, steps: stepsFor(q, facts) };
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
  // a step about something the page shows only with a feature on
  if (!step.target) return step.needs && step.needs !== "city" && !ctx.facts.features[step.needs] ? "offer" : "plain";
  if (ctx.found) return "show";
  if (step.optional) return "plain";
  if (step.needs === "city") return ctx.facts.city ? "missing" : "city";
  if (step.needs && !ctx.facts.features[step.needs]) return "offer";
  return "missing";
}

/**
 * The step to be on after she went to another page herself (opened a verse
 * from a dialog, a segment from its card): the first step from here on that
 * belongs to that page; the same step when none does.
 */
export function catchUp<T extends string, P extends string>(steps: HelpStep<T, P>[], index: number, home: P, here: P | null): number {
  if ((steps[index].page ?? home) === here) return index;
  const later = steps.findIndex((s, i) => i > index && (s.page ?? home) === here);
  return later === -1 ? index : later;
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


/**
 * What «التالي» does while a step's element is lit (Mona, 2026-11-08):
 * - wait: the lit button opens what the tour goes on with (a menu, a view, a
 *   form, a page). «التالي» doesn't move: the same button stays lit and the
 *   bubble says to press it first. Pressing it herself moves the tour on.
 *   This is every opener lit in the step's place, and the step's own «press»
 *   element unless it is already open or it is the last step.
 * - press: the last step's button that opens something: «تمّ» presses it, as before.
 * - next: everything else (a field, a section, a save button): on to the next step.
 * «التالي» never presses a button that the next step depends on: a tap
 * outside a menu closes it before such a press could land.
 */
export type NextMove = "wait" | "press" | "next";

export function nextMove(
  step: Pick<HelpStep, "kind">,
  at: {
    // the last step of the tour
    last: boolean;
    // the lit element is an opener of the step's own (a `via` entry)
    opener: boolean;
    // what the lit element opens is open already (a section, the ≈ list)
    open: boolean;
    // there is a control to press in it
    pressable: boolean;
  },
): NextMove {
  if (at.opener) return "wait";
  if ((step.kind ?? "look") !== "press" || at.open) return "next";
  if (at.last) return at.pressable ? "press" : "next";
  return "wait";
}

/**
 * The buttons a page's tours wait on (nextMove "wait"), by name: every opener
 * in a `via`, and each «press» step's own button but the last step's. Each one
 * needs its name for the bubble (the site's labels).
 */
export function waitsOn<T extends string>(questions: Pick<HelpQuestion<T>, "showMe" | "steps">[]): T[] {
  const names = new Set<T>();
  for (const q of questions) {
    if (!q.showMe) continue;
    q.steps.forEach((s, i) => {
      for (const v of s.via ?? []) names.add(v);
      if (s.kind === "press" && s.target && i < q.steps.length - 1) names.add(s.target);
    });
  }
  return [...names];
}

/** The button named in «اضغطي «…» للمتابعة»: its name in «», or a phrase of its own («على بطاقة المقطع»). */
export type PressLabel = string | { plain: string };

export const pressWhat = (label: PressLabel) => (typeof label === "string" ? `«${label}»` : label.plain);

/** «2 من 4» */
export const progressLabel = (index: number, count: number) => `${index + 1} من ${count}`;
