import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDE_PAGES } from "../../keys";
import { isGuideTarget } from "../targets";
import { genderText, pairsAreWellFormed } from "../text";
import { MAX_VISIBLE, nextPresses, splitQuestions } from "../run";
import { RAFIQ_HELP } from "./index";
import { isTourPage } from "./pages";
import { FEATURE_OFFER, HELP_UI } from "./ui";

// The help content as data: every page there, every text well formed in both
// genders, every element named in the allowlist, and no step that would let
// the guide press a save button for her.

const pages = GUIDE_PAGES.flatMap((id) => RAFIQ_HELP[id] ?? []);

function texts(): string[] {
  const all: string[] = [...Object.values(FEATURE_OFFER), ...Object.values(HELP_UI).filter((v): v is string => typeof v === "string")];
  for (const p of pages)
    for (const q of p.questions) {
      all.push(q.q, ...(q.notes ?? []));
      for (const s of q.steps) {
        all.push(s.text);
        if (s.missing) all.push(s.missing);
        if (s.blocked) all.push(s.blocked.text);
        if (s.alt) all.push(s.alt.text);
      }
    }
  return all;
}

test("help content: the 11 pages, each under its own id", () => {
  for (const id of GUIDE_PAGES) assert.equal(RAFIQ_HELP[id]?.id, id, id);
});

test("help content: at most 5 questions listed per page; every page has some", () => {
  for (const p of pages) {
    assert.ok(p.questions.length > 0, p.id);
    assert.ok(splitQuestions(p.questions).visible.length <= MAX_VISIBLE, p.id);
    assert.ok(p.questions.filter((q) => !q.more).length <= MAX_VISIBLE, `${p.id}: more than 5 marked as listed`);
  }
});

test("help content: every [f|m] pair well formed, nothing left in either gender", () => {
  for (const s of texts()) {
    assert.ok(pairsAreWellFormed(s), s);
    for (const g of ["FEMALE", "MALE"] as const) assert.doesNotMatch(genderText(s, g), /[[\]|]/, s);
    // a feminine «كِ» outside a pair is always a word's ending (so it can take the masculine form)
    assert.doesNotMatch(s.replace(/\[[^\]]*\]/g, ""), /كِ[\u0621-\u064A]/, s);
  }
});

test("help content: Western digits only", () => {
  for (const s of texts()) assert.doesNotMatch(s, /[٠-٩]/, s);
});

test("help content: named elements and pages exist; a feature step names a feature", () => {
  for (const p of pages)
    for (const q of p.questions)
      for (const s of q.steps) {
        for (const t of [s.target, s.blocked?.target, s.alt?.target, s.then?.target, ...(s.via ?? [])]) if (t) assert.ok(isGuideTarget(t), t);
        for (const page of [s.page, s.then?.page]) if (page) assert.ok(isTourPage(page), page);
        if (s.kind === "leave") assert.ok(s.then, `${p.id}: «${q.q}» leaves with nothing to light`);
        if (s.then) assert.equal(s.kind, "leave");
      }
});

test("help content: a step on a button that saves or deletes is never pressed by the guide", () => {
  const saving = /\.save$|\.delete$|practice\.finish/;
  for (const p of pages)
    for (const q of p.questions)
      for (const s of q.steps)
        if (s.target && saving.test(s.target) && s.target !== "settings.delete") assert.equal(nextPresses(s), false, `${p.id}: ${s.target}`);
});

test("help content: a question without «أرِني» has nothing to light", () => {
  for (const p of pages)
    for (const q of p.questions) if (!q.showMe) assert.ok(q.steps.every((s) => !s.target), `${p.id}: «${q.q}»`);
});

test("help content: «كيف أعطي كل بند وقتًا؟» — ⏱ with its way back, its fallback and the panel note (approved 2026-10-26)", () => {
  const q = RAFIQ_HELP.tracker!.questions.find((x) => x.q === "كيف أعطي كل بند وقتًا؟")!;
  const step = q.steps[0];
  assert.equal(step.target, "agenda.timeBtn");
  assert.deepEqual(step.via, ["tracker.back"]);
  assert.ok(isGuideTarget("tracker.back"));
  assert.equal(
    genderText(step.missing!, "FEMALE"),
    "يظهر ⏱ بجانب كل بند من بنود اليوم، ولا بنود لليوم في جدولكِ الآن. أضيفي بندًا من «⚙ البنود» ← «إدارة البنود»، ثم اضغطي ⏱ بجانبه.",
  );
  assert.equal(
    genderText(step.missing!, "MALE"),
    "يظهر ⏱ بجانب كل بند من بنود اليوم، ولا بنود لليوم في جدولك الآن. أضف بندًا من «⚙ البنود» ← «إدارة البنود»، ثم اضغط ⏱ بجانبه.",
  );
  assert.equal(q.notes?.[0], "يظهر ⏱ بجانب بنود اليوم فقط.");
});
