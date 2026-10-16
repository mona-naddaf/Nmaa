import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMasteredWords } from "@/lib/recitation/flagged-words";
import { validateDetails } from "./validate";

// al-Bayyina 98:1 — لَمْ(1) يَكُنِ(2) ٱلَّذِينَ(3) كَفَرُوا۟(4) مِنْ(5) أَهْلِ(6) ٱلْكِتَـٰبِ(7) … ٱلْبَيِّنَةُ(12, last)
const ok = (raw: unknown, from = 1, to = 8) => {
  const r = validateDetails(raw, 98, from, to);
  assert.ok("details" in r, "error" in r ? r.error : "");
  return r.details;
};
const bad = (raw: unknown, from = 1, to = 8) => assert.ok("error" in validateDetails(raw, 98, from, to));
const d = (o: Record<string, unknown>) => ({ ayah: 1, wordPosition: 7, letter: 5, gapAfter: false, kind: "HUKM", code: "madd.tabii", confusedWith: null, ...o });

test("a real letter, gap, kind and code are accepted, with the letter as shown", () => {
  const [x] = ok([d({})]);
  assert.equal(x.letterText, "ـٰ");
  assert.equal(x.wordText, "ٱلْكِتَـٰبِ");
  const [g] = ok([d({ wordPosition: 1, letter: 0, gapAfter: true, code: "gap_meem.izhar" })]);
  assert.equal(g.letterText, null);
  ok([d({ letter: 3, kind: "MAKHRAJ", code: "aqsa_lisan_k", confusedWith: "ق" })]);
  ok([d({ letter: 3, kind: "SIFA", code: "" })]);
  assert.deepEqual(ok(undefined), []);
});

test("anything not real is refused", () => {
  bad([d({ ayah: 9 })]); // outside the range
  bad([d({ wordPosition: 99 })]); // no such word
  bad([d({ letter: 7 })]); // the word has 6 letters
  bad([d({ letter: 0, gapAfter: false })]); // a whole word is a plain mistake, not a detail
  bad([d({ letter: 2, gapAfter: true })]); // a gap is never on a letter
  bad([d({ kind: "NONE" })]);
  bad([d({ code: "nope" })]);
  bad([d({ code: "gap_meem.izhar" })]); // a gap rule on a letter
  bad([d({ wordPosition: 1, letter: 0, gapAfter: true, kind: "SIFA", code: "" })]); // a gap holds rules only
  bad([d({ letter: 3, kind: "MAKHRAJ", code: "hafat_lisan" })]); // not a makhraj ك can come from
  bad([d({ confusedWith: "ق" })]); // «قريبًا من حرف» on makhraj only
  bad([d({ letter: 3, kind: "MAKHRAJ", code: "aqsa_lisan_k", confusedWith: "x" })]);
  bad([d({ letter: 3, kind: "MAKHRAJ", code: "aqsa_lisan_k", confusedWith: "قق" })]);
  bad([null]);
  // not a list: nothing detailed sent (as validateFlaggedWords reads it)
  assert.deepEqual(ok("not a list"), []);
});

test("a gap counts only while the word after it is recited too", () => {
  // after the last word of ayah 1: the next word is 98:2:1
  ok([d({ wordPosition: 12, letter: 0, gapAfter: true, code: "gap_waqf.qabih" })], 1, 2);
  bad([d({ wordPosition: 12, letter: 0, gapAfter: true, code: "gap_waqf.qabih" })], 1, 1);
  // the very end of the surah has no gap after it
  bad([d({ ayah: 8, wordPosition: 99, letter: 0, gapAfter: true, code: "gap_waqf.qabih" })]);
});

test("one spot combines as the form does: a specific code replaces its kind's general one", () => {
  const list = ok([d({ code: "" }), d({ code: "madd.tabii" }), d({ kind: "SIFA", code: "" }), d({ code: "madd.tabii" })]);
  assert.deepEqual(
    list.map((x) => `${x.kind}:${x.code}`),
    ["HUKM:madd.tabii", "SIFA:"],
  );
  // two different codes on one letter both stay
  assert.equal(ok([d({ letter: 3, kind: "SIFA", code: "hams" }), d({ letter: 3, kind: "SIFA", code: "shidda" })]).length, 2);
});

test("mastered spots: the whole word as before, or one letter / gap", () => {
  const r = validateMasteredWords(
    [{ ayah: 1, wordPosition: 7 }, { ayah: 1, wordPosition: 7, letter: 3 }, { ayah: 1, wordPosition: 1, gapAfter: true }],
    98,
    1,
    8,
  );
  assert.ok("words" in r);
  assert.deepEqual(r.words, [
    { ayah: 1, wordPosition: 7, letter: 0, gapAfter: false },
    { ayah: 1, wordPosition: 7, letter: 3, gapAfter: false },
    { ayah: 1, wordPosition: 1, letter: 0, gapAfter: true },
  ]);
  const twice = validateMasteredWords([{ ayah: 1, wordPosition: 7, letter: 3 }, { ayah: 1, wordPosition: 7, letter: 3 }], 98, 1, 8);
  assert.ok("error" in twice);
  assert.ok("error" in validateMasteredWords([{ ayah: 1, wordPosition: 7, letter: 9 }], 98, 1, 8));
  assert.ok("error" in validateMasteredWords([{ ayah: 1, wordPosition: 7, letter: 2, gapAfter: true }], 98, 1, 8));
});
