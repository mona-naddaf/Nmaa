import { test } from "node:test";
import assert from "node:assert/strict";
import { INTRO_IDS, WELCOME_IDS } from "./keys";
import { genderText, pairsAreWellFormed } from "./help/text";
import { CHECKLIST, EMPTY, GOT_IT, GUIDE_CARD, INTRO, INTRO_UI, TOUR_FROM, WELCOME } from "./lines-texts";
import { RAFIQ_HELP } from "./help/rafiq";

function all(): string[] {
  const out: string[] = [GOT_IT, ...Object.values(WELCOME), ...Object.values(INTRO_UI), ...Object.values(EMPTY), ...Object.values(GUIDE_CARD)];
  for (const i of Object.values(INTRO)) out.push(i.text, i.button);
  for (const v of Object.values(CHECKLIST)) {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "object") out.push(...Object.values(v));
  }
  out.push(CHECKLIST.count(1, 3));
  return out;
}

test("guide lines: a welcome line for every welcome id, an intro line for every feature", () => {
  for (const w of WELCOME_IDS) assert.ok(WELCOME[w], w);
  for (const i of INTRO_IDS) assert.ok(INTRO[i]?.text, i);
});

test("guide lines: every text well formed, and nothing left of the notation in either gender", () => {
  for (const s of all()) {
    assert.ok(pairsAreWellFormed(s), s);
    for (const g of ["FEMALE", "MALE"] as const) assert.doesNotMatch(genderText(s, g), /[[\]|]/, s);
  }
});

test("guide lines: a man's forms have no feminine «كِ» left", () => {
  for (const s of all()) assert.doesNotMatch(genderText(s, "MALE"), /كِ/, s);
  assert.equal(genderText(CHECKLIST.count(1, 2), "MALE"), "أنجزتَ 1 من 2");
  assert.equal(genderText(CHECKLIST.celebrate, "FEMALE"), "أحسنتِ، بدأتِ على مُكث 🌿");
  assert.equal(genderText(WELCOME.segment, "MALE"), "هذه صفحة التدريب على مقطعك. اضغط + في كل مرة تستمع أو تكرّر أو تسمّع لأحد.");
});

test("guide lines: Western digits only", () => {
  for (const s of all()) assert.doesNotMatch(s, /[٠-٩]/, s);
});

test("guide lines: the reset line names the checklist only in its own variant", () => {
  assert.match(GUIDE_CARD.hintsDoneWithChecklist, /قائمة الخطوات الأولى/);
  assert.doesNotMatch(GUIDE_CARD.hintsDone, /قائمة/);
});

test("guide lines: the tours started from outside the panel exist", () => {
  for (const { page, question } of Object.values(TOUR_FROM)) {
    const q = RAFIQ_HELP[page]?.questions.find((x) => x.q === question);
    assert.ok(q?.showMe, `${page}: ${question}`);
  }
});
