import type { HelpFacts, HelpFeature, HelpQuestion, HelpStep, EnableFeature } from "../types";
import type { GuideTarget } from "../targets";
import { fillFamily, type FamilyWho } from "./text";
import { CHILD_OFFERS } from "./adult";
import type { ChildSwitch, FamilyHelpPage, FamilyPageId, FamilyQuestion, FamilyRawPage } from "./types";

// From the content files to one viewer's help: which questions she has, which
// are locked (a child's switch off, no edit rights) and where they go, what
// «تفعيل الآن» offers, and the names and the child's forms filled in. The
// viewer's own [f|m] stay for the engine (genderText). Pure.

/** The shared lines (review page ٨, approved 2026-11-15). */
export const FAMILY_LINES = {
  // the child: a switch that is off
  childOff: "هذه الميزة غير مفعّلة [لكِ|لك] بعد. [اطلبي|اطلب] من [أهلكِ|أهلك] تفعيلها.",
  // a view-only adult: a question that needs edit rights
  needsEdit: "[تحتاجين|تحتاج] صلاحية التعديل. [اطلبيها|اطلبها] من {founder}.",
  // a view-only adult: the child's switch is off
  viewOff: "هذه الميزة غير مفعّلة لـ{name}. [تحتاجين|تحتاج] صلاحية التعديل لتفعيلها؛ [اطلبيها|اطلبها] من {founder}.",
  // an adult with edit rights, after «تفعيل الآن»
  enabled: "تم التفعيل ✓ يمكن إيقافها من «إعدادات {name}».",
} as const;

export type ChildSwitches = Record<ChildSwitch, boolean>;

/** The child's switches as the help's facts (a tour's «needs», the panel's offers). */
export function switchFacts(sw: ChildSwitches, highlight: boolean): HelpFacts {
  const features: Record<HelpFeature, boolean> & Partial<Record<EnableFeature, boolean>> = {
    agenda: sw.agenda,
    summary: sw.summary,
    similar: sw.similar,
    tajweed: sw.tajweed,
    review: sw.review,
    streak: sw.streak,
    goal: sw.goal,
    homeLog: sw.homeLog,
  };
  return { features, city: false, plan: true, founder: false, ...(highlight ? { highlight: true } : {}) };
}

/** The switch «تفعيل الآن» turns on for a question's `feat` (none: no offer). */
const ENABLES: Partial<Record<ChildSwitch, EnableFeature>> = {
  streak: "streak",
  summary: "summary",
  agenda: "agenda",
  goal: "goal",
  review: "review",
  similar: "similar",
  tajweed: "tajweed",
  homeLog: "homeLog",
};

const fillStep = (s: HelpStep<GuideTarget, FamilyPageId>, who: FamilyWho): HelpStep<GuideTarget, FamilyPageId> => ({
  ...s,
  text: fillFamily(s.text, who),
  ...(s.missing ? { missing: fillFamily(s.missing, who) } : {}),
  ...(s.blocked ? { blocked: { ...s.blocked, text: fillFamily(s.blocked.text, who) } } : {}),
  ...(s.options ? { options: s.options.map((o) => fillFamily(o, who)) } : {}),
  ...(s.alt ? { alt: { ...s.alt, text: fillFamily(s.alt.text, who) } } : {}),
});

/** A raw question as plain help: extras dropped, texts filled. */
function plain(q: FamilyQuestion, who: FamilyWho, extra: Partial<HelpQuestion<GuideTarget, FamilyPageId>> = {}, note?: string): HelpQuestion<GuideTarget, FamilyPageId> {
  const { id: _id, role: _role, feat: _feat, roleNotes: _rn, ...rest } = q;
  const merged = { ...rest, ...extra };
  const notes = [...(merged.notes ?? []), ...(note ? [note] : [])];
  return {
    ...merged,
    q: fillFamily(merged.q, who),
    steps: merged.steps.map((s) => fillStep(s, who)),
    ...(notes.length ? { notes: notes.map((n) => fillFamily(n, who)) } : { notes: undefined }),
    ...(merged.offer ? { offer: { ...merged.offer, text: fillFamily(merged.offer.text, who) } } : {}),
    ...(merged.locked ? { locked: fillFamily(merged.locked, who) } : {}),
  };
}

const page = (raw: FamilyRawPage, who: FamilyWho, questions: HelpQuestion<GuideTarget, FamilyPageId>[]): FamilyHelpPage => ({
  id: raw.id,
  title: fillFamily(raw.title, who),
  questions,
});

/** The child herself: a question whose switch is off goes under «أسئلة أخرى» with U1. */
export function childHelpPage(raw: FamilyRawPage, sw: ChildSwitches, who: FamilyWho): FamilyHelpPage {
  return page(
    raw,
    who,
    raw.questions.map((q) => (q.feat && !sw[q.feat] ? plain(q, who, { locked: FAMILY_LINES.childOff, more: true }) : plain(q, who))),
  );
}

/** An adult on a child's pages: edit questions locked for a view-only adult; a switch off offered (or U4). */
export function adultChildHelpPage(raw: FamilyRawPage, sw: ChildSwitches, canEdit: boolean, who: FamilyWho): FamilyHelpPage {
  return page(
    raw,
    who,
    raw.questions.map((q) => {
      if (q.role === "edit" && !canEdit) return plain(q, who, { locked: FAMILY_LINES.needsEdit, more: true });
      if (q.feat && !sw[q.feat]) {
        if (!canEdit) return plain(q, who, { locked: FAMILY_LINES.viewOff, more: true });
        const feature = ENABLES[q.feat];
        const text = CHILD_OFFERS[q.feat];
        if (feature && text) return plain(q, who, { offer: { feature, text } });
      }
      return plain(q, who);
    }),
  );
}

export type FamilyViewerRole = "founder" | "edit" | "view";

/** An adult on her own family pages, by her role there. */
export function familyHelpPage(raw: FamilyRawPage, role: FamilyViewerRole, who: FamilyWho): FamilyHelpPage {
  const questions: HelpQuestion<GuideTarget, FamilyPageId>[] = [];
  for (const q of raw.questions) {
    if (q.role === "founder" && role !== "founder") continue;
    if (q.role === "member" && role === "founder") continue;
    if (q.role === "edit" && role === "view") {
      questions.push(plain(q, who, { locked: FAMILY_LINES.needsEdit, more: true }));
      continue;
    }
    questions.push(plain(q, who, {}, q.roleNotes ? (role === "view" ? q.roleNotes.view : q.roleNotes.edit) : undefined));
  }
  return page(raw, who, questions);
}
