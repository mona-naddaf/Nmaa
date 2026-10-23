import { test } from "node:test";
import assert from "node:assert/strict";
import { decideGuide, guideAtSignup, resetFor, type GuideInput, type GuideStates } from "./rules";
import { GUIDE_KEYS } from "./keys";

const base: GuideInput = { on: true, kind: "ADULT", isNew: true, states: {}, page: "home" };
const run = (over: Partial<GuideInput>) => decideGuide({ ...base, ...over });
const states = (...keys: (keyof GuideStates)[]): GuideStates => Object.fromEntries(keys.map((k) => [k, null]));

// ---------- off and «العائلة» ----------

test("decideGuide: guidance off shows nothing, even to a new account", () => {
  const d = run({ on: false, states: states("hints.restored"), intros: ["agenda"] });
  assert.deepEqual(d, run({ on: false }));
  assert.equal(d.wizard.startAfterSignup, false);
  assert.equal(d.wizard.card, null);
  assert.equal(d.checklist.show, false);
  assert.equal(d.welcome, null);
  assert.equal(d.intro, null);
});

test("decideGuide: a child gets nothing, whatever her row says", () => {
  const d = run({ kind: "CHILD", isNew: true, states: states("hints.restored"), intros: ["agenda"], checklistComplete: true });
  assert.equal(d.wizard.startAfterSignup, false);
  assert.equal(d.wizard.card, null);
  assert.equal(d.checklist.show, false);
  assert.equal(d.checklist.celebrate, false);
  assert.equal(d.welcome, null);
  assert.equal(d.intro, null);
});

test("decideGuide: «العائلة» pages (no page) get no welcome or intro line", () => {
  const d = run({ page: null, intros: ["agenda"] });
  assert.equal(d.welcome, null);
  assert.equal(d.intro, null);
});

// ---------- existing accounts (guideNewAt = NULL) ----------

test("decideGuide: an existing account is already onboarded: no questions, card, checklist or welcome line", () => {
  const d = run({ isNew: false });
  assert.equal(d.wizard.startAfterSignup, false);
  assert.equal(d.wizard.card, null);
  assert.equal(d.checklist.show, false);
  assert.equal(d.welcome, null);
});

test("decideGuide: an existing account still gets intro lines, one per page", () => {
  assert.equal(run({ isNew: false, intros: ["agenda", "summary"] }).intro, "agenda");
  assert.equal(run({ isNew: false, intros: [] }).intro, null);
});

// ---------- a new account ----------

test("decideGuide: a new account goes to the setup questions after the recovery رمز", () => {
  const d = run({});
  assert.equal(d.wizard.startAfterSignup, true);
  assert.equal(d.wizard.mode, "first");
  assert.deepEqual(d.wizard.card, { remaining: 5 });
});

test("decideGuide: «إكمال الأسئلة لاحقًا» at question 3: the card says 3 are left", () => {
  assert.deepEqual(run({ states: { "wizard.step": { q: 3 } } }).wizard.card, { remaining: 3 });
  assert.deepEqual(run({ states: { "wizard.step": { q: 5 } } }).wizard.card, { remaining: 1 });
});

test("decideGuide: finished questions: no card and no restart after signup", () => {
  const d = run({ states: states("wizard.done") });
  assert.equal(d.wizard.card, null);
  assert.equal(d.wizard.startAfterSignup, false);
});

test("decideGuide: «إخفاء» on the resume card hides it", () => {
  assert.equal(run({ states: states("wizard.cardHidden") }).wizard.card, null);
});

// ---------- a «العائلة» invite signup (M1) ----------

test("decideGuide: an invite signup gets no automatic questions, but the resume card", () => {
  const d = run({ states: { "wizard.deferred": { via: "family" } } });
  assert.equal(d.wizard.startAfterSignup, false);
  assert.deepEqual(d.wizard.card, { remaining: 5 });
});

test("decideGuide: an invite signup gets the checklist and welcome lines like any new account", () => {
  const d = run({ states: { "wizard.deferred": { via: "family" } } });
  assert.equal(d.checklist.show, true);
  assert.equal(d.welcome, "home");
});

// ---------- «إعادة أسئلة البداية» (M2) ----------

test("decideGuide: a re-run is offered to an existing account too, in re-run mode", () => {
  const d = run({ isNew: false, states: states("wizard.rerun") });
  assert.equal(d.wizard.mode, "rerun");
  assert.deepEqual(d.wizard.card, { remaining: 5 });
  // a re-run is opened from the settings, never right after a signup
  assert.equal(d.wizard.startAfterSignup, false);
});

test("decideGuide: a finished re-run closes its card", () => {
  assert.equal(run({ isNew: false, states: states("wizard.rerun", "wizard.done") }).wizard.card, null);
});

// ---------- «الخطوات الأولى» ----------

test("decideGuide: the checklist shows until complete or hidden", () => {
  assert.equal(run({}).checklist.show, true);
  assert.equal(run({ states: states("checklist.hidden") }).checklist.show, false);
  assert.equal(run({ checklistComplete: true }).checklist.show, false);
});

test("decideGuide: the completion line once, and not after «إخفاء القائمة»", () => {
  assert.equal(run({ checklistComplete: true }).checklist.celebrate, true);
  assert.equal(run({ checklistComplete: true, states: states("checklist.celebrated") }).checklist.celebrate, false);
  assert.equal(run({ checklistComplete: true, states: states("checklist.hidden") }).checklist.celebrate, false);
});

test("decideGuide: «لا، ليس الآن» to the tracker hides item 2 until she adds an item", () => {
  assert.equal(run({}).checklist.trackerItem, true);
  assert.equal(run({ states: states("checklist.noTracker") }).checklist.trackerItem, false);
  assert.equal(run({ states: states("checklist.noTracker"), hasTrackerItems: true }).checklist.trackerItem, true);
});

// ---------- welcome lines ----------

test("decideGuide: a new account's welcome line on each page until «فهمت»", () => {
  assert.equal(run({ page: "tracker" }).welcome, "tracker");
  assert.equal(run({ page: "tracker", states: states("welcome.tracker") }).welcome, null);
  // dismissing one page's line leaves the others
  assert.equal(run({ page: "notes", states: states("welcome.tracker") }).welcome, "notes");
});

test("decideGuide: «خطتي»'s first-setup lines are dismissed apart from its own", () => {
  assert.equal(run({ page: "plan", welcome: "plan-setup" }).welcome, "plan-setup");
  assert.equal(run({ page: "plan", welcome: "plan-setup", states: states("welcome.plan") }).welcome, "plan-setup");
  assert.equal(run({ page: "plan", welcome: "plan-custom", states: states("welcome.plan-custom") }).welcome, null);
});

// ---------- «إظهار الإرشادات من جديد» (M3) ----------

test("decideGuide: after the reset an existing account sees each welcome line once more", () => {
  const restored = states("hints.restored");
  assert.equal(run({ isNew: false, page: "tracker", states: restored }).welcome, "tracker");
  assert.equal(run({ isNew: false, page: "settings", states: restored }).welcome, "settings");
  // … until «فهمت» again
  assert.equal(run({ isNew: false, page: "tracker", states: { ...restored, "welcome.tracker": null } }).welcome, null);
});

test("decideGuide: after the reset an existing account gets dismissed intro lines back", () => {
  // the reset removed the intro.* rows: the first eligible one shows again
  assert.equal(run({ isNew: false, states: states("hints.restored"), intros: ["review", "goal"] }).intro, "review");
});

test("decideGuide: the reset never brings the checklist to an existing account", () => {
  const d = run({ isNew: false, states: states("hints.restored") });
  assert.equal(d.checklist.show, false);
  assert.equal(d.checklist.celebrate, false);
});

test("decideGuide: the reset doesn't start the questions for an existing account", () => {
  const d = run({ isNew: false, states: states("hints.restored") });
  assert.equal(d.wizard.card, null);
  assert.equal(d.wizard.startAfterSignup, false);
});

// ---------- intro lines ----------

test("decideGuide: one intro line at a time, the first not yet dismissed", () => {
  assert.equal(run({ intros: ["agenda", "summary", "city"] }).intro, "agenda");
  assert.equal(run({ intros: ["agenda", "summary", "city"], states: states("intro.agenda") }).intro, "summary");
  assert.equal(run({ intros: ["agenda"], states: states("intro.agenda") }).intro, null);
});

// ---------- signup ----------

test("guideAtSignup: marked new only while guidance is on", () => {
  assert.deepEqual(guideAtSignup(false, null), { isNew: false, deferred: false });
  assert.deepEqual(guideAtSignup(false, "/rafiq/family"), { isNew: false, deferred: false });
  assert.deepEqual(guideAtSignup(true, null), { isNew: true, deferred: false });
});

test("guideAtSignup: a «العائلة» invite defers the questions", () => {
  assert.deepEqual(guideAtSignup(true, "/rafiq/family"), { isNew: true, deferred: true });
  assert.deepEqual(guideAtSignup(true, "/rafiq/family/join?code=AB12-CD34"), { isNew: true, deferred: true });
});

// ---------- the two settings buttons ----------

test("resetFor wizard: clears the progress and the deferral, marks the re-run", () => {
  const r = resetFor("wizard");
  assert.deepEqual([...r.remove].sort(), ["wizard.cardHidden", "wizard.deferred", "wizard.done", "wizard.step"]);
  assert.equal(r.set, "wizard.rerun");
});

test("resetFor hints: clears every welcome and intro line and a hidden checklist, nothing else", () => {
  const r = resetFor("hints");
  assert.equal(r.set, "hints.restored");
  for (const k of GUIDE_KEYS) {
    const should = k.startsWith("welcome.") || k.startsWith("intro.") || k === "checklist.hidden";
    assert.equal(r.remove.includes(k), should, k);
  }
  // a finished checklist and the setup questions are untouched
  assert.ok(!r.remove.includes("checklist.celebrated"));
  assert.ok(!r.remove.some((k) => k.startsWith("wizard.")));
});
