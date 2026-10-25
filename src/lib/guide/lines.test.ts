import { test } from "node:test";
import assert from "node:assert/strict";
import { checklistComesBack, checklistComplete, checklistItems, checklistProgress, introsFor, planWelcome, welcomeFor, type IntroFacts } from "./lines";
import { decideGuide } from "./rules";

const NONE = { sessions: 0, trackerItems: 0, trackerChecks: 0 };
const OFF = { agenda: false, summary: false, similar: false, tajweed: false, review: false };

test("plan welcome: custom from the questions, first setup, then the page's own", () => {
  assert.equal(planWelcome({ hasPlan: false, fromStart: true }), "plan-custom");
  assert.equal(planWelcome({ hasPlan: false, fromStart: false }), "plan-setup");
  assert.equal(planWelcome({ hasPlan: true, fromStart: false }), "plan");
  // ?from=start once a plan is saved: the page's own line
  assert.equal(planWelcome({ hasPlan: true, fromStart: true }), "plan");
  assert.equal(welcomeFor("tracker", { hasPlan: false, fromStart: true }), "tracker");
  assert.equal(welcomeFor("plan", { hasPlan: false, fromStart: false }), "plan-setup");
});

test("checklist: three items, none done for a new account", () => {
  const items = checklistItems(NONE, {});
  assert.deepEqual(items.map((i) => i.id), ["session", "tracker", "homelog"]);
  assert.ok(items.every((i) => !i.done));
  assert.deepEqual(checklistProgress(items), { done: 0, total: 3 });
});

test("checklist: item 2 asks for an item while the tracker is empty, then for a tick", () => {
  const add = checklistItems(NONE, {})[1];
  assert.deepEqual(add, { id: "tracker", add: true, done: false });
  // a check left from an item since removed doesn't count while empty
  assert.deepEqual(checklistItems({ ...NONE, trackerChecks: 4 }, {})[1], { id: "tracker", add: true, done: false });
  assert.deepEqual(checklistItems({ ...NONE, trackerItems: 2 }, {})[1], { id: "tracker", add: false, done: false });
  assert.deepEqual(checklistItems({ ...NONE, trackerItems: 2, trackerChecks: 1 }, {})[1], { id: "tracker", add: false, done: true });
});

test("checklist: each item ticks from her data, item 3 from her first visit", () => {
  const facts = { sessions: 1, trackerItems: 1, trackerChecks: 1 };
  assert.deepEqual(checklistProgress(checklistItems(facts, {})), { done: 2, total: 3 });
  assert.equal(checklistComplete(facts, {}), false);
  assert.equal(checklistComplete(facts, { "checklist.homelog": null }), true);
});

test("checklist: «لا، ليس الآن» hides item 2 (1 من 2) until she adds an item", () => {
  const no = { "checklist.noTracker": null };
  const items = checklistItems({ ...NONE, sessions: 1 }, no);
  assert.deepEqual(items.map((i) => i.id), ["session", "homelog"]);
  assert.deepEqual(checklistProgress(items), { done: 1, total: 2 });
  assert.equal(checklistComplete({ ...NONE, sessions: 1 }, { ...no, "checklist.homelog": null }), true);
  // she added an item herself: back, counted from 3
  const back = checklistItems({ sessions: 1, trackerItems: 1, trackerChecks: 0 }, no);
  assert.deepEqual(checklistProgress(back), { done: 1, total: 3 });
});

test("checklist: the same item-2 rule as decideGuide", () => {
  for (const states of [{}, { "checklist.noTracker": null }]) {
    for (const trackerItems of [0, 1]) {
      const shown = checklistItems({ ...NONE, trackerItems }, states).some((i) => i.id === "tracker");
      const d = decideGuide({ on: true, kind: "ADULT", isNew: true, states, hasTrackerItems: trackerItems > 0 });
      assert.equal(shown, d.checklist.trackerItem, JSON.stringify({ states, trackerItems }));
    }
  }
});

test("hints reset: names the checklist only for a new account's hidden, unfinished list", () => {
  const hidden = { "checklist.hidden": null };
  assert.equal(checklistComesBack(true, hidden, false), true);
  assert.equal(checklistComesBack(true, hidden, true), false);
  assert.equal(checklistComesBack(true, {}, false), false);
  assert.equal(checklistComesBack(false, hidden, false), false);
});

const base: IntroFacts = { features: OFF, city: false };

test("intros, «صفحتي»: the flagger's lines only while it is open", () => {
  assert.deepEqual(introsFor("home", base), []);
  assert.deepEqual(introsFor("home", { ...base, flaggerOpen: true }), ["mutashabihat"]);
  assert.deepEqual(introsFor("home", { ...base, flaggerOpen: true, flaggedWords: true }), ["mutashabihat", "tajweed"]);
  assert.deepEqual(introsFor("home", { ...base, flaggerOpen: true, features: { ...OFF, similar: true, tajweed: true }, flaggedWords: true }), []);
});

test("intros, «صفحتي»: review after a completed surah, goal from the third session without one", () => {
  assert.deepEqual(introsFor("home", { ...base, completedSurah: true }), ["review"]);
  assert.deepEqual(introsFor("home", { ...base, completedSurah: true, features: { ...OFF, review: true } }), []);
  assert.deepEqual(introsFor("home", { ...base, sessions: 2, goal: false }), []);
  assert.deepEqual(introsFor("home", { ...base, sessions: 3, goal: false }), ["goal"]);
  assert.deepEqual(introsFor("home", { ...base, sessions: 9, goal: true }), []);
  assert.deepEqual(introsFor("home", { ...base, completedSurah: true, sessions: 3, goal: false, flaggerOpen: true }), ["mutashabihat", "review", "goal"]);
});

test("intros, segment page: similar verses while off, then the notes tip", () => {
  assert.deepEqual(introsFor("segment", base), ["mutashabihat", "verseNotes"]);
  assert.deepEqual(introsFor("segment", { ...base, features: { ...OFF, similar: true } }), ["verseNotes"]);
});

test("intros, tracker: agenda from 2 items, summary after 7 days, city with agenda on and no city", () => {
  assert.deepEqual(introsFor("tracker", { ...base, trackerItems: 1, trackerDays: 3 }), []);
  assert.deepEqual(introsFor("tracker", { ...base, trackerItems: 2, trackerDays: 6 }), ["agenda"]);
  assert.deepEqual(introsFor("tracker", { ...base, trackerItems: 2, trackerDays: 7 }), ["agenda", "summary"]);
  assert.deepEqual(introsFor("tracker", { ...base, trackerItems: 0, trackerDays: 30 }), []);
  assert.deepEqual(introsFor("tracker", { ...base, features: { ...OFF, agenda: true }, trackerItems: 2, trackerDays: 1 }), ["city"]);
  assert.deepEqual(introsFor("tracker", { ...base, city: true, features: { ...OFF, agenda: true, summary: true }, trackerItems: 5, trackerDays: 40 }), []);
});

test("intros: none on the other pages", () => {
  for (const page of ["plan", "homelog", "summary", "templates", "calendar", "notes", "verse", "settings"] as const) {
    assert.deepEqual(introsFor(page, { ...base, trackerItems: 5, trackerDays: 40, completedSurah: true, sessions: 5, goal: false, flaggerOpen: true }), [], page);
  }
});

test("intros with a welcome line: one at a time, the welcome first", () => {
  const intros = introsFor("tracker", { ...base, trackerItems: 2 });
  const first = decideGuide({ on: true, kind: "ADULT", isNew: true, states: {}, page: "tracker", intros });
  assert.deepEqual([first.welcome, first.intro], ["tracker", null]);
  const after = decideGuide({ on: true, kind: "ADULT", isNew: true, states: { "welcome.tracker": null }, page: "tracker", intros });
  assert.deepEqual([after.welcome, after.intro], [null, "agenda"]);
});
