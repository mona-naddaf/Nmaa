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
  // C1.10 on «صفحتي» with «حفظي في البيت» off (Mona, 2026-11-15)
  childHomeLogOff: "التظليل يكون في «حفظي في البيت»، وهي غير مفعّلة [لكِ|لك] بعد. [اطلبي|اطلب] من [أهلكِ|أهلك] تفعيلها.",
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
  highlight: "highlight",
};

/** A question's switches, as a list. */
const featsOf = (q: FamilyQuestion): ChildSwitch[] => (q.feat === undefined ? [] : Array.isArray(q.feat) ? q.feat : [q.feat]);

/** The child's locked line: «حفظي في البيت» named when it is the one off among several, U1 otherwise. */
function childLockedLine(q: FamilyQuestion, off: ChildSwitch[]): string {
  return off.includes("homeLog") && featsOf(q).length > 1 ? FAMILY_LINES.childHomeLogOff : FAMILY_LINES.childOff;
}

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
  const { id: _id, role: _role, feat: _feat, roleNotes: _rn, lockedOnly: _lo, editMissing: _em, ...rest } = q;
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
    raw.questions.flatMap((q) => {
      const off = featsOf(q).filter((f) => !sw[f]);
      if (off.length) return [plain(q, who, { locked: childLockedLine(q, off), more: true })];
      return q.lockedOnly ? [] : [plain(q, who)];
    }),
  );
}

/**
 * An adult on a child's pages: edit questions locked for a view-only adult; a
 * switch off offered (or U4). `hide`: questions with nothing to do here (A2.3
 * with nothing to copy).
 */
export function adultChildHelpPage(raw: FamilyRawPage, sw: ChildSwitches, canEdit: boolean, who: FamilyWho, hide: ReadonlySet<string> = new Set()): FamilyHelpPage {
  return page(
    raw,
    who,
    raw.questions.filter((q) => !hide.has(q.id)).map((q) => {
      if (q.role === "edit" && !canEdit) return plain(q, who, { locked: FAMILY_LINES.needsEdit, more: true });
      const off = featsOf(q).find((f) => !sw[f]);
      if (off) {
        if (!canEdit) return plain(q, who, { locked: FAMILY_LINES.viewOff, more: true });
        const feature = ENABLES[off];
        const text = CHILD_OFFERS[off];
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
    const em = role !== "view" ? q.editMissing : undefined;
    const extra = em ? { steps: q.steps.map((s) => (s.target === em.target ? { ...s, missing: em.text } : s)) } : {};
    questions.push(plain(q, who, extra, q.roleNotes ? (role === "view" ? q.roleNotes.view : q.roleNotes.edit) : undefined));
  }
  return page(raw, who, questions);
}
