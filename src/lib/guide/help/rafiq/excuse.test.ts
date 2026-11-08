import { test } from "node:test";
import assert from "node:assert/strict";
import { decideGuide } from "../../rules";
import { commitmentChosen, introsFor, type IntroFacts } from "../../lines";
import { isGuideTarget } from "../targets";
import { pairsAreWellFormed } from "../text";
import { MAX_VISIBLE, panelShows, splitQuestions, stepsFor, waitsOn } from "../run";
import type { HelpFacts } from "../types";
import { excuseGuideEligible, excuseGuideFor, excuseSnapshotParts, type ExcuseGuideInput } from "./excuse";
import { withExcuseHelp } from "./excuse-types";
import { RAFIQ_HELP } from "./index";
import { FEATURE_OFFER, HELP_UI, PRESS_LABELS } from "./ui";

const woman: ExcuseGuideInput = { kind: "ADULT", gender: "FEMALE", excuseAllowed: true, previewAllowed: true };
const others: [string, ExcuseGuideInput][] = [
  ["a man", { ...woman, gender: "MALE" }],
  ["no gender", { ...woman, gender: null }],
  ["a child", { ...woman, kind: "CHILD" }],
  ["a girl child", { ...woman, kind: "CHILD", gender: "FEMALE" }],
  ["the feature not available", { ...woman, excuseAllowed: false }],
  ["not on the preview list", { ...woman, previewAllowed: false }],
];

const features = { agenda: false, summary: false, similar: false, tajweed: false, review: false };
const facts = (excuse?: boolean): HelpFacts => ({ features, city: false, plan: true, founder: false, ...(excuse === undefined ? {} : { excuse }) });
const intro = (over: Partial<IntroFacts>): IntroFacts => ({ features, city: false, ...over });

const guide = excuseGuideFor({ ...woman, on: false })!;
const all = Object.values(guide.help).flat();

test("excuse guide: an adult woman with the feature and on the list, nobody else", () => {
  assert.equal(excuseGuideEligible(woman), true);
  for (const [who, input] of others) assert.equal(excuseGuideEligible(input), false, who);
});

test("excuse guide: an ineligible snapshot carries no word of it and no key", () => {
  for (const [who, input] of others)
    for (const on of [false, true]) {
      assert.equal(excuseGuideFor({ ...input, on }), null, who);
      const parts = excuseSnapshotParts({ ...input, on, states: { "intro.excuse": null, "intro.agenda": null } });
      assert.equal(Object.hasOwn(parts, "excuse"), false, who);
      assert.equal(Object.hasOwn(parts.facts, "excuse"), false, who);
      assert.deepEqual(parts.states, { "intro.agenda": null }, who);
      assert.doesNotMatch(JSON.stringify(parts), /عذر|معذورة|excuse/, who);
    }
});

test("excuse guide: hers carries the lines, the help and whether it's on", () => {
  const parts = excuseSnapshotParts({ ...woman, on: true, states: { "intro.excuse": null } });
  assert.equal(parts.excuse?.on, true);
  assert.equal(parts.facts.excuse, true);
  assert.ok(Object.hasOwn(parts.states, "intro.excuse"));
});

test("excuse guide: nothing about it in what every browser loads", () => {
  const shared = JSON.stringify({ RAFIQ_HELP, HELP_UI, FEATURE_OFFER });
  assert.doesNotMatch(shared, /أيام العذر|معذورة|بدء العذر/);
});

test("excuse guide: four questions on her three pages, under «أسئلة أخرى», well formed", () => {
  assert.deepEqual(Object.keys(guide.help).sort(), ["home", "settings", "tracker"]);
  assert.equal(all.length, 4);
  for (const q of all) {
    assert.equal(q.more, true, q.q);
    assert.ok(q.offer, q.q);
    for (const text of [q.q, q.offer!.text, ...(q.notes ?? []), ...q.steps.flatMap((s) => [s.text, ...(s.options ?? [])])]) {
      assert.ok(pairsAreWellFormed(text), text);
      assert.doesNotMatch(text, /\[|كود/, text);
    }
    for (const s of q.steps) if (s.target) assert.ok(isGuideTarget(s.target), s.target);
  }
});

test("excuse guide: «تفعيل» reaches both lines, and the texts are the approved ones", () => {
  assert.match(guide.enabled.tracker, /إلغاء تفعيلها/);
  assert.match(guide.enabled.home, /إلغاء تفعيلها/);
  assert.doesNotMatch(JSON.stringify(guide), /لإيقافها|إيقافها من/);
  const q = guide.help.tracker![1];
  assert.equal(q.steps.length, 4);
  assert.equal(q.steps[2].options?.length, 3);
});

test("excuse help: added after a page's own, never among the 5 listed, and only hers", () => {
  for (const id of ["home", "settings", "tracker"] as const) {
    const page = RAFIQ_HELP[id]!;
    const { visible, more } = splitQuestions(withExcuseHelp(page, guide).questions);
    assert.ok(visible.length <= MAX_VISIBLE);
    assert.equal(
      visible.some((q) => guide.help[id]!.includes(q)),
      false,
      id,
    );
    for (const q of guide.help[id]!) assert.ok(more.includes(q), q.q);
    assert.equal(withExcuseHelp(page, null), page);
  }
});

test("excuse help: feature off, the offer in place of the steps; on, the steps", () => {
  const q = guide.help.settings![0];
  assert.equal(panelShows(q, facts(false)), "offer");
  assert.equal(panelShows(q, facts(true)), "steps");
  assert.equal(stepsFor(q, facts(true)).length, 3);
  // a question with no offer always shows its steps
  assert.equal(panelShows(RAFIQ_HELP.tracker!.questions[0], facts()), "steps");
});

test("excuse lines: the tracker's needs an item; «صفحتي»'s needs her commitment; neither once on", () => {
  assert.deepEqual(introsFor("tracker", intro({ excuse: false, trackerItems: 1 })), ["excuse"]);
  assert.deepEqual(introsFor("tracker", intro({ excuse: false, trackerItems: 0 })), []);
  assert.deepEqual(introsFor("tracker", intro({ excuse: true, trackerItems: 1 })), []);
  assert.deepEqual(introsFor("home", intro({ excuse: false, commitSet: true })), ["excuse"]);
  assert.deepEqual(introsFor("home", intro({ excuse: false, commitSet: false })), []);
  assert.deepEqual(introsFor("home", intro({ excuse: true, commitSet: true })), []);
});

test("excuse lines: no line for anyone without the guide (excuse unset)", () => {
  assert.equal(introsFor("tracker", intro({ trackerItems: 5 })).includes("excuse"), false);
  assert.deepEqual(introsFor("home", intro({ commitSet: true })), []);
});

test("excuse lines: «has commitment days set» = she saved them, or logged a session; a new empty account doesn't", () => {
  assert.equal(commitmentChosen({ savedDays: true, loggedSessions: 0 }), true);
  assert.equal(commitmentChosen({ savedDays: false, loggedSessions: 1 }), true);
  assert.equal(commitmentChosen({ savedDays: false, loggedSessions: 0 }), false);
});

test("excuse lines: one key: dismissed or enabled on one page, gone from both", () => {
  const states = { "intro.excuse": null };
  const base = { on: true, kind: "ADULT" as const, isNew: false, states };
  assert.equal(decideGuide({ ...base, page: "tracker", intros: ["excuse"] }).intro, null);
  assert.equal(decideGuide({ ...base, page: "home", intros: ["excuse"] }).intro, null);
});

test("excuse lines: one line at a time: after the welcome and after the other intro lines", () => {
  const base = { on: true, kind: "ADULT" as const, page: "tracker" as const };
  const intros = introsFor("tracker", intro({ excuse: false, trackerItems: 3 }));
  assert.deepEqual(intros, ["agenda", "excuse"]);
  assert.equal(decideGuide({ ...base, isNew: false, states: {}, intros }).intro, "agenda");
  assert.equal(decideGuide({ ...base, isNew: false, states: { "intro.agenda": null }, intros }).intro, "excuse");
  const welcomed = decideGuide({ ...base, isNew: true, states: { "intro.agenda": null }, intros });
  assert.equal(welcomed.welcome, "tracker");
  assert.equal(welcomed.intro, null);
});

test("excuse help: H2 waits for «إدارة البنود» and then ✎ (Mona, 2026-11-08); every button waited on has its name", () => {
  const h2 = guide.help.tracker!.find((q) => q.q === "كيف أحدّد ما يُحسب من البنود في أيام العذر؟")!;
  assert.deepEqual(waitsOn([h2]).sort(), ["tracker.itemEdit", "tracker.menu", "tracker.menu.items"]);
  assert.equal(h2.steps[1].target, "tracker.itemEdit");
  for (const name of waitsOn(all)) assert.ok(PRESS_LABELS[name], name);
});
