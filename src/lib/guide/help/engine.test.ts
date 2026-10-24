import { test } from "node:test";
import assert from "node:assert/strict";
import { genderText, pairsAreWellFormed } from "./text";
import { MAX_VISIBLE, nextPresses, onPress, progressLabel, splitQuestions, stepView, stepsFor, type StepContext } from "./run";
import type { HelpFacts, HelpQuestion, HelpStep, StepKind } from "./types";
import { GUIDE_TARGETS, isGuideTarget, targetAttr } from "./targets";
import { helpPageFor, hrefOf, tourPageFor } from "./rafiq/pages";

const facts = (over: Partial<HelpFacts> = {}, features: Partial<HelpFacts["features"]> = {}): HelpFacts => ({
  features: { agenda: false, summary: false, similar: false, tajweed: false, review: false, ...features },
  city: false,
  plan: true,
  founder: false,
  ...over,
});

// ---------- texts ----------

test("genderText: [f|m] pairs in her gender, an empty masculine ending included", () => {
  const s = "[اضغطي|اضغط] «حفظ» لتختار[ي|] السورة.";
  assert.equal(genderText(s, "FEMALE"), "اضغطي «حفظ» لتختاري السورة.");
  assert.equal(genderText(s, "MALE"), "اضغط «حفظ» لتختار السورة.");
  // no gender given: masculine
  assert.equal(genderText(s, null), "اضغط «حفظ» لتختار السورة.");
});

test("genderText: a possessive written only in the feminine takes the masculine form for a man", () => {
  const s = "هنا [خطتكِ|خطتك]: ترتيب السور، وهدفكِ، وما [حفظتِه|حفظتَه] من قبل.";
  assert.equal(genderText(s, "FEMALE"), "هنا خطتكِ: ترتيب السور، وهدفكِ، وما حفظتِه من قبل.");
  assert.equal(genderText(s, "MALE"), "هنا خطتك: ترتيب السور، وهدفك، وما حفظتَه من قبل.");
});

test("pairsAreWellFormed: a stray bracket or bar is caught", () => {
  assert.equal(pairsAreWellFormed("[اضغطي|اضغط] هنا"), true);
  assert.equal(pairsAreWellFormed("[اضغطي اضغط] هنا"), false);
  assert.equal(pairsAreWellFormed("[اضغطي|اضغط هنا"), false);
  assert.equal(pairsAreWellFormed("لا شيء | هنا"), false);
});

// ---------- targets ----------

test("targets: listed once each, and nothing at all while the guidance is off", () => {
  assert.equal(new Set(GUIDE_TARGETS).size, GUIDE_TARGETS.length);
  assert.equal(isGuideTarget("record.save"), true);
  assert.equal(isGuideTarget("record.nope"), false);
  assert.deepEqual(targetAttr("record.save", true), { "data-guide": "record.save" });
  assert.equal(targetAttr("record.save", false), undefined);
  // spreading it adds no attribute
  assert.deepEqual({ ...targetAttr("record.save", false) }, {});
});

// ---------- the panel ----------

test("splitQuestions: at most 5 listed; the rest, and the ones marked, under «أسئلة أخرى»", () => {
  const q = (n: number, more = false) => ({ n, more });
  const a = splitQuestions([q(1), q(2), q(3, true), q(4), q(5)]);
  assert.deepEqual(a.visible.map((x) => x.n), [1, 2, 4, 5]);
  assert.deepEqual(a.more.map((x) => x.n), [3]);
  const b = splitQuestions([q(1), q(2), q(3), q(4), q(5), q(6), q(7, true)]);
  assert.equal(b.visible.length, MAX_VISIBLE);
  assert.deepEqual(b.more.map((x) => x.n), [6, 7]);
});

test("stepsFor: a step for founders only, and the daily agenda's own first step", () => {
  const q: HelpQuestion = {
    q: "?",
    showMe: true,
    steps: [
      { text: "family", target: "nav.family", when: "founder" },
      { text: "tick it", target: "tracker.sheet", alt: { when: "agenda", text: "tick the circle" } },
      { text: "first setup", alt: { when: "noPlan", text: "in the setup", target: "plan.prior" } },
    ],
  };
  assert.deepEqual(stepsFor(q, facts()).map((s) => s.text), ["tick it", "first setup"]);
  const on = stepsFor(q, facts({ founder: true, plan: false }, { agenda: true }));
  assert.deepEqual(on.map((s) => s.text), ["family", "tick the circle", "in the setup"]);
  assert.equal(on[1].target, "tracker.sheet");
  assert.equal(on[2].target, "plan.prior");
  assert.equal("alt" in on[1], false);
});

// ---------- «أرِني» ----------

const ctx = (over: Partial<StepContext<string>> = {}): StepContext<string> => ({
  here: "home",
  home: "home",
  found: false,
  blocked: false,
  facts: facts(),
  hrefOf: (p) => (p === "verse" ? null : `/${p}`),
  ...over,
});

test("stepView: the element there is lit; a step without one is said on its own", () => {
  assert.equal(stepView({ text: "", target: "record.save" }, ctx({ found: true })), "show");
  assert.equal(stepView({ text: "" }, ctx()), "plain");
});

test("stepView: a step on another page links there, unless the page has no address of its own", () => {
  assert.equal(stepView({ text: "", target: "plan.goal", page: "plan" }, ctx()), "away");
  assert.equal(stepView({ text: "", target: "verse.newNote", page: "verse" }, ctx()), "missing");
  // on that page now
  assert.equal(stepView({ text: "", target: "plan.goal", page: "plan" }, ctx({ here: "plan", found: true })), "show");
  // a question of another page, its steps followed here
  assert.equal(stepView({ text: "", target: "tracker.publish" }, ctx({ here: "templates", home: "tracker" })), "away");
});

test("stepView: missing element: «تفعيل الآن» for a feature that is off, else «هذا الجزء غير موجود بعد»", () => {
  const step: HelpStep = { text: "", target: "review.section", needs: "review", missing: "none yet" };
  assert.equal(stepView(step, ctx()), "offer");
  assert.equal(stepView(step, ctx({ facts: facts({}, { review: true }) })), "missing");
  assert.equal(stepView({ text: "", target: "record.reason" }, ctx()), "missing");
});

test("stepView: the city is picked in the settings, not switched on", () => {
  const step: HelpStep = { text: "", target: "agenda.timeBtn", needs: "city" };
  assert.equal(stepView(step, ctx()), "city");
  assert.equal(stepView(step, ctx({ facts: facts({ city: true }) })), "missing");
});

test("stepView: a limit message on the page stands in for the step", () => {
  const step: HelpStep = { text: "", target: "homeLog.new", blocked: { target: "homeLog.limit", text: "limit" } };
  assert.equal(stepView(step, ctx({ found: true, blocked: true })), "blocked");
  assert.equal(stepView(step, ctx({ found: true })), "show");
});

test("A: pressing the lit element moves the tour only for a button that opens something", () => {
  const press = (kind?: StepKind) => onPress({ kind });
  assert.equal(press("press"), "next");
  // a field or a section stays hers to use; she moves on with «التالي»
  assert.equal(press("look"), "stay");
  assert.equal(press(undefined), "stay");
  // a save button is pressed by her alone and doesn't move the tour
  assert.equal(press("save"), "stay");
  // «عائلتي»: opens that page with the card lit, and the tour ends there
  assert.equal(press("leave"), "then");
});

test("«التالي» presses the lit element for her only when it opens something, never a save", () => {
  assert.equal(nextPresses({ kind: "press" }), true);
  for (const kind of ["look", "save", "leave", undefined] as const) assert.equal(nextPresses({ kind }), false);
});

test("progressLabel: «2 من 4», Western digits", () => {
  assert.equal(progressLabel(1, 4), "2 من 4");
});

// ---------- Rafiq's pages ----------

test("helpPageFor: the 11 pages, and none where there is no help", () => {
  const cases: [string, string | null][] = [
    ["/rafiq", "home"],
    ["/rafiq/", "home"],
    ["/rafiq/plan", "plan"],
    ["/rafiq/home-log", "homelog"],
    ["/rafiq/home-log/clx123", "segment"],
    ["/rafiq/tracker", "tracker"],
    ["/rafiq/tracker/summary", "summary"],
    ["/rafiq/templates", "templates"],
    ["/rafiq/calendar", "calendar"],
    ["/rafiq/notes", "notes"],
    ["/rafiq/verse/18/10", "verse"],
    ["/rafiq/settings", "settings"],
    ["/rafiq/start", null],
    ["/rafiq/family", null],
    ["/rafiq/family/abc", null],
    ["/rafiq/login", null],
    ["/rafiq/signup", null],
    ["/rafiq/recover", null],
    ["/family/login", null],
    ["/rafiq/verse/18", null],
  ];
  for (const [path, page] of cases) assert.equal(helpPageFor(path), page, path);
});

test("tourPageFor: «عائلتي» (the list, or her one family's page) for the founder step only", () => {
  assert.equal(tourPageFor("/rafiq/family"), "family");
  assert.equal(tourPageFor("/rafiq/family/abc"), "family");
  assert.equal(tourPageFor("/rafiq/family/new"), null);
  assert.equal(tourPageFor("/rafiq/family/join"), null);
  assert.equal(tourPageFor("/rafiq/family/abc/calendar"), null);
  assert.equal(tourPageFor("/rafiq/plan"), "plan");
  assert.equal(hrefOf("plan"), "/rafiq/plan");
  assert.equal(hrefOf("verse"), null);
  assert.equal(hrefOf("segment"), null);
  assert.equal(hrefOf("family"), "/rafiq/family");
});
