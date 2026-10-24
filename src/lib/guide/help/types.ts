// The help content's shape: what a page's «؟ كيف أستخدم هذه الصفحة» panel
// lists and what «أرِني» walks through. Content files are plain data in the
// review page's own notation ([f|m] for a word that changes with the
// viewer's gender), so they read side by side with the approved texts. The
// engine doesn't know which site it runs on: page ids and target names are
// type parameters, so the courses can bring their own later.

/**
 * What a step does with the lit element:
 * - look: shows it (a field, a section, a number). She may use it freely and
 *   moves on with «التالي»; a click on it doesn't move the tour.
 * - press: a button that opens a menu, a section, a dialog or a page.
 *   Pressing it moves to the next step; «التالي» presses it for her.
 * - save: a button that saves or deletes. The guide only points at it:
 *   «التالي» never presses it, and pressing it doesn't move the tour.
 * - leave: a link to a page outside the guide («عائلتي»). «التالي» moves on
 *   here; pressing it opens that page with `then` lit, and the tour ends there.
 */
export type StepKind = "look" | "press" | "save" | "leave";

/** Features «تفعيل الآن» can turn on from inside a tour. */
export type HelpFeature = "agenda" | "summary" | "similar" | "tajweed" | "review";

/** What she has, as far as a tour needs to know. */
export type HelpFacts = {
  features: Record<HelpFeature, boolean>;
  // a place for prayer times
  city: boolean;
  // a saved plan (none yet: «خطتي» is the first setup)
  plan: boolean;
  // founds a family («العائلة» on)
  founder: boolean;
};

/** A condition on her facts: a step shows only when it holds, or an alternative replaces it. */
export type HelpCond = "agenda" | "founder" | "noPlan";

export type HelpStep<T extends string = string, P extends string = string> = {
  text: string;
  target?: T;
  kind?: StepKind;
  // the step is on another page than its question's
  page?: P;
  // the lit element only shows with this feature on («تفعيل الآن»), or with a city
  needs?: HelpFeature | "city";
  // «إن لم يظهر»: what to say when the element isn't there (with what it needs on)
  missing?: string;
  // «إن ظهرت رسالة الحدّ»: when this element shows, the step can't be done; say why
  blocked?: { target: T; text: string };
  // inside something closed (a menu, a list view): what opens it, outermost
  // first; while the element is hidden, the innermost opener showing is lit
  // instead (each one once: pressed, it isn't lit again in this step)
  via?: T[];
  // the element shows only sometimes («إلغاء التغييرات»): without it, the sentence alone
  optional?: true;
  // only when this holds
  when?: HelpCond;
  // in place of the text and target when this holds
  alt?: { when: HelpCond; text: string; target?: T };
  // kind "leave": the page it opens and what is lit there
  then?: { page: P; target: T };
};

export type HelpQuestion<T extends string = string, P extends string = string> = {
  q: string;
  steps: HelpStep<T, P>[];
  // has «أرِني» (a question that is only explained has none)
  showMe: boolean;
  // lines under the steps
  notes?: string[];
  // under «أسئلة أخرى»
  more?: boolean;
};

export type HelpPage<T extends string = string, P extends string = string> = {
  id: P;
  // the page's name, as in «كيف أستخدم «{اسم الصفحة}»؟»
  title: string;
  questions: HelpQuestion<T, P>[];
};
