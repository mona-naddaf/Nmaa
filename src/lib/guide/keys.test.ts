import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGuideValue, GUIDE_KEYS, GUIDE_PAGES, INTRO_IDS, isClientKey, isGuideKey, WELCOME_IDS } from "./keys";

test("guide keys: every page, welcome line and intro line has its key", () => {
  assert.equal(GUIDE_PAGES.length, 11);
  for (const w of WELCOME_IDS) assert.ok(isGuideKey(`welcome.${w}`), w);
  for (const i of INTRO_IDS) assert.ok(isGuideKey(`intro.${i}`), i);
  assert.equal(new Set(GUIDE_KEYS).size, GUIDE_KEYS.length);
});

test("guide keys: anything outside the allowlist is refused", () => {
  for (const bad of ["", "wizard", "wizard.", "welcome.family", "welcome.", "intro.unknown", "__proto__", "constructor", "toString", "Wizard.done", " wizard.done", "wizard.done ", "welcome.home.x", "x".repeat(500)]) {
    assert.equal(isGuideKey(bad), false, JSON.stringify(bad));
  }
  for (const bad of [null, undefined, 1, {}, ["wizard.done"]]) assert.equal(isGuideKey(bad), false);
});

test("guide keys: the server's own markers can't be set by the page", () => {
  for (const k of ["wizard.deferred", "wizard.rerun", "hints.restored"]) {
    assert.equal(isGuideKey(k), true, k);
    assert.equal(isClientKey(k), false, k);
  }
  for (const k of ["wizard.step", "wizard.done", "wizard.cardHidden", "checklist.hidden", "checklist.celebrated", "checklist.noTracker", "checklist.homelog", "checklist.times", "welcome.home", "intro.goal"]) {
    assert.equal(isClientKey(k), true, k);
  }
});

test("guide values: wizard.step takes a question number 1–5 and nothing else", () => {
  assert.deepEqual(checkGuideValue("wizard.step", { q: 1 }), { q: 1 });
  assert.deepEqual(checkGuideValue("wizard.step", { q: 5 }), { q: 5 });
  // extra fields are dropped, not stored
  assert.deepEqual(checkGuideValue("wizard.step", { q: 2, note: "x".repeat(5000) }), { q: 2 });
  for (const bad of [{ q: 0 }, { q: 6 }, { q: 2.5 }, { q: "2" }, { q: -1 }, {}, null, undefined, 3, "q"]) {
    assert.equal(checkGuideValue("wizard.step", bad), undefined, JSON.stringify(bad));
  }
});

test("guide values: wizard.deferred is { via: family } only", () => {
  assert.deepEqual(checkGuideValue("wizard.deferred", { via: "family" }), { via: "family" });
  assert.equal(checkGuideValue("wizard.deferred", { via: "other" }), undefined);
  assert.equal(checkGuideValue("wizard.deferred", null), undefined);
});

test("guide values: every other key stores no value", () => {
  assert.equal(checkGuideValue("welcome.home", null), null);
  assert.equal(checkGuideValue("welcome.home", undefined), null);
  assert.equal(checkGuideValue("checklist.hidden", { anything: 1 }), undefined);
  assert.equal(checkGuideValue("intro.agenda", "yes"), undefined);
  assert.equal(checkGuideValue("checklist.homelog", null), null);
  assert.equal(checkGuideValue("checklist.homelog", true), undefined);
});
