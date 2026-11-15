import "server-only";
import { prisma } from "@/lib/db";
import { guidePreviewAllowed } from "@/lib/guide/enabled";
import { familyExcuseAllowed, viewerOverrides } from "@/lib/excuse/family-data";
import { familySees } from "@/lib/excuse/visibility";
import { CHILD_HELP } from "@/lib/guide/help/family/child";
import { ADULT_HELP } from "@/lib/guide/help/family/adult";
import { FAMILY_HELP } from "@/lib/guide/help/family/family";
import { familyExcuseHelp } from "@/lib/guide/help/family/excuse";
import { adultChildHelpPage, childHelpPage, familyHelpPage, FAMILY_LINES, switchFacts } from "@/lib/guide/help/family/build";
import { FAMILY_PAGE_TITLE } from "@/lib/guide/help/family/pages";
import { fillFamily, type FamilyWho } from "@/lib/guide/help/family/text";
import type { FamilyHelpPage, FamilyPageId } from "@/lib/guide/help/family/types";
import type { HelpFacts } from "@/lib/guide/help/types";
import type { ChildGuidePage } from "@/lib/guide/family-keys";
import type { PersonGender } from "@/lib/text/gender";
import { adultFamilyGuide, childGuideFacts, type ChildGuideFacts } from "./guide";

// The props of «العائلة»'s three help hosts, built here on the server for
// the one viewer: her questions, locked or offered, with every name filled,
// and the excuse questions only for whoever they are for. What isn't hers
// never leaves the server.

type Pages = Partial<Record<FamilyPageId, FamilyHelpPage>>;

const titlesFor = (who: FamilyWho) => Object.fromEntries(Object.entries(FAMILY_PAGE_TITLE).map(([k, v]) => [k, fillFamily(v, who)])) as Record<FamilyPageId, string>;

/** Adds a page's excuse questions after its own (they are all under «أسئلة أخرى»). */
function withExtra(pages: Pages, extra: Partial<Record<FamilyPageId, FamilyHelpPage["questions"]>>, who: FamilyWho): Pages {
  const out = { ...pages };
  for (const [id, qs] of Object.entries(extra) as [FamilyPageId, FamilyHelpPage["questions"]][]) {
    const p = out[id];
    if (!p || !qs.length) continue;
    out[id] = {
      ...p,
      questions: [
        ...p.questions,
        ...qs.map((q) => ({
          ...q,
          q: fillFamily(q.q, who),
          steps: q.steps.map((s) => ({ ...s, text: fillFamily(s.text, who) })),
          ...(q.notes ? { notes: q.notes.map((n) => fillFamily(n, who)) } : {}),
        })),
      ],
    };
  }
  return out;
}

export type ChildGuideProps = {
  gender: PersonGender;
  pages: Pages;
  titles: Record<FamilyPageId, string>;
  facts: HelpFacts;
  // the welcome lines still to show (a new child only), filled
  welcome: Partial<Record<ChildGuidePage, string>>;
  preview: boolean;
};

const CHILD_PAGE: Partial<Record<FamilyPageId, ChildGuidePage>> = {
  "c.home": "home",
  "c.plan": "plan",
  "c.tracker": "tracker",
  "c.summary": "summary",
  "c.homelog": "homelog",
  "c.segment": "segment",
  "c.family": "family",
  "c.calendar": "calendar",
};

/** The child herself (/family): null when the guide doesn't reach her family. */
export async function childGuideProps(childId: string): Promise<ChildGuideProps | null> {
  const c = await childGuideFacts(childId);
  if (!c) return null;
  const who: FamilyWho = { child: { name: c.name, gender: c.gender }, family: c.familyName, founder: c.founder };
  let pages: Pages = Object.fromEntries(CHILD_HELP.map((raw) => [raw.id, childHelpPage(raw, c.switches, who)]));
  if (c.gender === "FEMALE") {
    const [allowed, row] = await Promise.all([familyExcuseAllowed(c.familyId), prisma.rafiqUser.findUnique({ where: { id: childId }, select: { excuseEnabled: true } })]);
    pages = withExtra(pages, familyExcuseHelp({ girl: true, allowed, on: !!row?.excuseEnabled, streak: c.switches.streak, viewer: { kind: "child" } }), who);
  }
  const welcome: Partial<Record<ChildGuidePage, string>> = {};
  if (c.isNew) {
    for (const raw of CHILD_HELP) {
      const id = CHILD_PAGE[raw.id];
      if (id && raw.welcome && !Object.hasOwn(c.states, `child.welcome.${id}`)) welcome[id] = fillFamily(raw.welcome, who);
    }
  }
  return {
    gender: c.gender,
    pages,
    titles: titlesFor(who),
    facts: switchFacts(c.switches, c.highlight),
    welcome,
    preview: guidePreviewAllowed(c.founderEmail),
  };
}

export type AdultChildGuideProps = {
  gender: "MALE" | "FEMALE";
  pages: Pages;
  titles: Record<FamilyPageId, string>;
  facts: HelpFacts;
  base: string;
  childId: string;
  canEdit: boolean;
  enabledText: string;
  settingsLabel: string;
  preview: boolean;
};

/** An adult on one child's pages: null when the guide doesn't reach the family. */
export async function adultChildGuideProps(
  viewer: { id: string; gender: "MALE" | "FEMALE" },
  familyId: string,
  child: { id: string },
  canEdit: boolean,
): Promise<{ props: AdultChildGuideProps; facts: ChildGuideFacts } | null> {
  const c = await childGuideFacts(child.id);
  if (!c || c.familyId !== familyId) return null;
  const who: FamilyWho = { child: { name: c.name, gender: c.gender }, family: c.familyName, founder: c.founder };
  let pages: Pages = Object.fromEntries(ADULT_HELP.map((raw) => [raw.id, adultChildHelpPage(raw, c.switches, canEdit, who)]));
  if (c.gender === "FEMALE") {
    const [allowed, row, overrides] = await Promise.all([
      familyExcuseAllowed(familyId),
      prisma.rafiqUser.findUnique({ where: { id: c.id }, select: { excuseEnabled: true } }),
      viewerOverrides(c.id),
    ]);
    const sees = familySees({ kind: "ADULT", id: viewer.id, gender: viewer.gender }, { id: c.id, gender: "FEMALE", excuseEnabled: true }, overrides);
    pages = withExtra(
      pages,
      familyExcuseHelp({ girl: true, allowed, on: !!row?.excuseEnabled, streak: c.switches.streak, viewer: { kind: "adult", sees, canEdit, card: allowed } }),
      who,
    );
  }
  return {
    facts: c,
    props: {
      gender: viewer.gender,
      pages,
      titles: titlesFor(who),
      facts: switchFacts(c.switches, c.highlight),
      base: `/rafiq/family/${familyId}/child/${c.id}`,
      childId: c.id,
      canEdit,
      enabledText: fillFamily(FAMILY_LINES.enabled, who),
      settingsLabel: fillFamily("إعدادات {name}", who),
      preview: guidePreviewAllowed(c.founderEmail),
    },
  };
}

export type FamilyPagesGuideProps = {
  gender: PersonGender;
  families: Record<string, Pages>;
  list: Pages;
  titles: Record<FamilyPageId, string>;
  preview: boolean;
};

/** An adult's own family pages: null when the guide reaches none of hers (nor her). */
export async function familyPagesGuideProps(email: string | null): Promise<FamilyPagesGuideProps | null> {
  const g = await adultFamilyGuide();
  if (!g) return null;
  const raw = (id: FamilyPageId) => FAMILY_HELP.find((p) => p.id === id)!;
  const families: Record<string, Pages> = {};
  for (const f of g.families) {
    if (!f.on) continue;
    const who: FamilyWho = { family: f.name, founder: f.founder };
    families[f.id] = { "f.family": familyHelpPage(raw("f.family"), f.role, who), "f.calendar": familyHelpPage(raw("f.calendar"), f.role, who) };
  }
  return {
    gender: g.gender,
    families,
    list: { "f.list": familyHelpPage(raw("f.list"), "view", {}) },
    titles: titlesFor({}),
    preview: guidePreviewAllowed(email),
  };
}
