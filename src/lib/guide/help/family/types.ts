import type { GuideTarget } from "../targets";
import type { HelpQuestion, HelpPage } from "../types";

// «العائلة»'s help pages and the raw questions their content files hold:
// a Rafiq help question, plus who it is for (the adult's rights in the
// family) and which of the child's switches it needs. build.ts turns them
// into plain help for one viewer.

export type FamilyPageId =
  // the child herself (/family)
  | "c.home"
  | "c.plan"
  | "c.tracker"
  | "c.summary"
  | "c.homelog"
  | "c.segment"
  | "c.family"
  | "c.calendar"
  // an adult on one child's pages
  | "a.home"
  | "a.tracker"
  | "a.summary"
  | "a.homelog"
  | "a.segment"
  | "a.plan"
  | "a.settings"
  // an adult's own family pages
  | "f.list"
  | "f.new"
  | "f.join"
  | "f.family"
  | "f.calendar";

/** A child's switch, as her settings name them (null days: review reminders off). */
export type ChildSwitch = "homeLog" | "homeMistakes" | "goal" | "similar" | "tajweed" | "agenda" | "summary" | "streak" | "review" | "highlight";

/**
 * Who a question is for:
 * - all: every adult; view: every adult (a child's pages)
 * - edit: needs edit rights (a view-only adult has it under «أسئلة أخرى» with U2)
 * - founder: the founder only (hidden for everyone else)
 * - member: everyone but the founder
 */
export type FamilyRole = "all" | "view" | "edit" | "founder" | "member";

export type FamilyQuestion = HelpQuestion<GuideTarget, FamilyPageId> & {
  // the review page's id (C1.1, A2.3, F4…)
  id: string;
  role?: FamilyRole;
  // the child's switch(es) it needs (all of them on)
  feat?: ChildSwitch | ChildSwitch[];
  // the child herself: listed only while one of its switches is off (with
  // its locked line), because with them all on it lives on another page (C1.10)
  lockedOnly?: true;
  // view-only adults: a line under the steps in place of the edit one (FC2)
  roleNotes?: { edit: string; view: string };
  // adults with edit rights: this «إن لم يظهر» line in place of the step's own (FC2)
  editMissing?: { target: GuideTarget; text: string };
};

export type FamilyRawPage = { id: FamilyPageId; title: string; questions: FamilyQuestion[]; welcome?: string };

export type FamilyHelpPage = HelpPage<GuideTarget, FamilyPageId>;
