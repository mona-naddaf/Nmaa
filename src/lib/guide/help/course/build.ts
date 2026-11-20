import type { HelpQuestion, HelpStep } from "../types";
import type { GuideTarget } from "../targets";
import { COURSE_LINES } from "../../course-texts";
import { FEATURE_CARD } from "./server-texts";
import type { CourseFeature, CourseFeatures, CourseHelpPage, CoursePageId, CourseQuestion, CourseRawPage, StaffFacts } from "./types";

// From the content files to one viewer's help (on the server): which
// questions she has, which are locked (a teacher without the permission, a
// feature off) and where they go, what «تفعيل الآن» offers the supervisor,
// and the course's words filled in. The viewer's own [f|m] stay for the
// engine (genderText). Pure.

/** The course's words: its students' forms, and the supervisor as the lines and labels name her. */
export type CourseFill = {
  // <f|m>: the course's students (or, for a parent, the child)
  students: "f" | "m";
  // {sup}: «مشرفة الدورة» / «مشرف الدورة»
  sup?: string;
  // {supOnly}: the permission choice's label, exactly as on the settings page
  supOnly?: string;
};

const STUDENT_PAIR = /<([^<>|]*)\|([^<>|]*)>/g;

export function fillCourse(text: string, fill: CourseFill): string {
  let out = text.replace(STUDENT_PAIR, (_, f: string, m: string) => (fill.students === "f" ? f : m));
  if (fill.sup !== undefined) out = out.replace(/\{sup\}/g, fill.sup);
  if (fill.supOnly !== undefined) out = out.replace(/\{supOnly\}/g, fill.supOnly);
  return out;
}

/** True when no <…|…> pair or {…} name is left (a test helper for the content files). */
export const courseFilled = (text: string): boolean => !/<[^<>]*\|[^<>]*>|\{(sup|supOnly)\}/.test(text);

type Q = HelpQuestion<GuideTarget, CoursePageId>;

const fillStep = (s: HelpStep<GuideTarget, CoursePageId>, fill: CourseFill): HelpStep<GuideTarget, CoursePageId> => ({
  ...s,
  text: fillCourse(s.text, fill),
  ...(s.missing ? { missing: fillCourse(s.missing, fill) } : {}),
  ...(s.blocked ? { blocked: { ...s.blocked, text: fillCourse(s.blocked.text, fill) } } : {}),
  ...(s.options ? { options: s.options.map((o) => fillCourse(o, fill)) } : {}),
  ...(s.alt ? { alt: { ...s.alt, text: fillCourse(s.alt.text, fill) } } : {}),
});

/** A raw question as plain help: the course's extras dropped (functions never leave the server), texts filled. */
export function plainCourse<F>(q: CourseQuestion<F>, fill: CourseFill, extra: Partial<Q> = {}): Q {
  const { id: _id, adminOnly: _a, perm: _p, feat: _f, hideOff: _h, show: _s, ...rest } = q;
  const merged: Q = { ...rest, ...extra };
  return {
    ...merged,
    q: fillCourse(merged.q, fill),
    steps: merged.steps.map((s) => fillStep(s, fill)),
    ...(merged.notes?.length ? { notes: merged.notes.map((n) => fillCourse(n, fill)) } : { notes: undefined }),
    ...(merged.offer ? { offer: { ...merged.offer, text: fillCourse(merged.offer.text, fill) } } : {}),
    ...(merged.locked ? { locked: fillCourse(merged.locked, fill) } : {}),
  };
}

export const featsOf = <F>(q: CourseQuestion<F>): CourseFeature[] => (q.feat === undefined ? [] : Array.isArray(q.feat) ? q.feat : [q.feat]);

/** The first of its features that is off, if any. */
const offFeature = <F>(q: CourseQuestion<F>, features: CourseFeatures): CourseFeature | undefined => featsOf(q).find((f) => !features[f]);

/** «تفعيل الآن» for the supervisor: the card that has the switch. */
export const offerFor = (feature: CourseFeature | "excuse") => ({
  feature: `card.${FEATURE_CARD[feature].card}` as const,
  text: COURSE_LINES.offer(FEATURE_CARD[feature].title),
});

/**
 * The supervisor or a teacher: supervisor-only questions hidden for a
 * teacher; a feature off offered to the supervisor (to its card), a line for a
 * teacher (or hidden with hideOff); a permission she lacks: the question
 * stays, under «أسئلة أخرى», with the line that the supervisor can grant it.
 */
export function staffHelpPage(raw: CourseRawPage<StaffFacts>, facts: StaffFacts, fill: CourseFill): CourseHelpPage {
  const questions: Q[] = [];
  for (const q of raw.questions) {
    if (q.adminOnly && facts.role !== "admin") continue;
    if (q.show && !q.show(facts)) continue;
    const off = offFeature(q, facts.features);
    if (off) {
      if (facts.role === "admin") questions.push(plainCourse(q, fill, { offer: offerFor(off) }));
      else if (!q.hideOff) questions.push(plainCourse(q, fill, { locked: COURSE_LINES.off, more: true }));
      continue;
    }
    if (q.perm && facts.role === "teacher" && !facts.perms[q.perm]) {
      questions.push(plainCourse(q, fill, { locked: COURSE_LINES.needsPerm, more: true }));
      continue;
    }
    questions.push(plainCourse(q, fill));
  }
  return { id: raw.id, title: fillCourse(raw.title, fill), questions };
}

/** A student or a parent: a feature off is a line (or hidden with hideOff); nothing to enable. */
export function viewerHelpPage<F extends { features: CourseFeatures }>(raw: CourseRawPage<F>, facts: F, fill: CourseFill): CourseHelpPage {
  const questions: Q[] = [];
  for (const q of raw.questions) {
    if (q.show && !q.show(facts)) continue;
    if (offFeature(q, facts.features)) {
      if (!q.hideOff) questions.push(plainCourse(q, fill, { locked: COURSE_LINES.off, more: true }));
      continue;
    }
    questions.push(plainCourse(q, fill));
  }
  return { id: raw.id, title: fillCourse(raw.title, fill), questions };
}
