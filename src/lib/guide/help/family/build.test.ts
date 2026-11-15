import { test } from "node:test";
import assert from "node:assert/strict";
import { adultChildHelpPage, childHelpPage, familyHelpPage, FAMILY_LINES, type ChildSwitches } from "./build";
import { CHILD_HELP } from "./child";
import { ADULT_HELP } from "./adult";
import { FAMILY_HELP } from "./family";
import { isGuideTarget } from "../targets";
import type { FamilyPageId } from "./types";

const OFF: ChildSwitches = { homeLog: false, homeMistakes: false, goal: false, similar: false, tajweed: false, agenda: false, summary: false, streak: false, review: false, highlight: false };
const sw = (on: Partial<ChildSwitches>): ChildSwitches => ({ ...OFF, ...on });
const who = { child: { name: "سارة", gender: "FEMALE" as const }, family: "عائلة أحمد", founder: "منى" };
const HIGHLIGHT_Q = "كيف أظلّل مقطعًا؟";

const childPage = (id: FamilyPageId, s: ChildSwitches) => childHelpPage(CHILD_HELP.find((p) => p.id === id)!, s, who);
const highlightQ = (id: FamilyPageId, s: ChildSwitches) => childPage(id, s).questions.find((q) => q.q === HIGHLIGHT_Q);

test("C1.10: with «حفظي في البيت» and «التظليل» on, highlighting is in «حفظي في البيت», not on «صفحتي»", () => {
  const on = sw({ homeLog: true, highlight: true });
  assert.equal(highlightQ("c.home", on), undefined);
  for (const id of ["c.homelog", "c.segment"] as const) {
    const q = highlightQ(id, on)!;
    assert.equal(q.locked, undefined);
    assert.equal(q.steps.find((s) => s.target === "highlight.button")?.optional, undefined, "«تظليل» is always lit");
  }
});

test("C1.10 on «صفحتي»: «حفظي في البيت» off names it; only «التظليل» off is U1", () => {
  assert.equal(highlightQ("c.home", sw({ highlight: true }))!.locked, FAMILY_LINES.childHomeLogOff);
  assert.equal(highlightQ("c.home", sw({}))!.locked, FAMILY_LINES.childHomeLogOff);
  assert.equal(highlightQ("c.home", sw({ homeLog: true }))!.locked, FAMILY_LINES.childOff);
  assert.equal(highlightQ("c.segment", sw({ homeLog: true }))!.locked, FAMILY_LINES.childOff);
});

test("adult highlighting question: edit rights see the steps or the offer; view-only get U2", () => {
  const home = ADULT_HELP.find((p) => p.id === "a.home")!;
  const q = (s: ChildSwitches, canEdit: boolean) => adultChildHelpPage(home, s, canEdit, who).questions.find((x) => x.q.startsWith("كيف أظلّل مقطعًا"))!;
  assert.equal(q(sw({ highlight: true }), true).locked, undefined);
  assert.equal(q(sw({}), true).offer?.feature, "highlight");
  assert.equal(q(sw({ highlight: true }), false).locked, FAMILY_LINES.needsEdit.replace("{founder}", "منى"));
});

test("A2.3 is left out when there is nothing to copy", () => {
  const tracker = ADULT_HELP.find((p) => p.id === "a.tracker")!;
  const copy = (hide: Set<string>) => adultChildHelpPage(tracker, OFF, true, who, hide).questions.some((x) => x.steps.some((s) => s.target === "tracker.copy"));
  assert.equal(copy(new Set()), true);
  assert.equal(copy(new Set(["A2.3"])), false);
});

test("every «أرِني» target in the family guide is a known name, and the steps fixed for an empty state say what is missing", () => {
  const all = [...CHILD_HELP, ...ADULT_HELP, ...FAMILY_HELP].flatMap((p) => p.questions);
  for (const q of all) for (const s of q.steps) if (s.target) assert.ok(isGuideTarget(s.target), `${q.id}: ${s.target}`);
  const fixed = ["history.section", "tracker.itemRow", "agenda.timeBtn", "practice.delete", "family.childCode", "family.city", "family.addChild", "calendar.dayItem", "calendar.adjust"];
  for (const q of all)
    for (const s of q.steps)
      if (s.target && fixed.includes(s.target)) {
        assert.equal(s.optional, undefined, `${q.id}: ${s.target} is not optional`);
        assert.ok(s.missing, `${q.id}: ${s.target} has a missing line`);
      }
});

test("FC2: adults with edit rights get «اختاري يومًا فيه مناسبة.»; whoever edits only their own keeps «…أضفتِها»", () => {
  const cal = FAMILY_HELP.find((p) => p.id === "f.calendar")!;
  const line = (role: "founder" | "edit" | "view") =>
    familyHelpPage(cal, role, who)
      .questions.flatMap((q) => q.steps)
      .find((s) => s.target === "calendar.dayItem" && s.missing)!.missing;
  assert.equal(line("founder"), "[اختاري|اختر] يومًا فيه مناسبة.");
  assert.equal(line("edit"), "[اختاري|اختر] يومًا فيه مناسبة.");
  assert.equal(line("view"), "[اختاري|اختر] يومًا فيه مناسبة [أضفتِها|أضفتَها].");
});
