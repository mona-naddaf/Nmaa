import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, checkOccurrence, normalizeWord, sharedInOrder, type RawPhrase } from "./build";

const w = (s: string) => s.split(" ");

test("normalizeWord: harakat and Quranic marks off, alef and ya forms unified", () => {
  assert.equal(normalizeWord("ٱللَّهِ"), "الله");
  assert.equal(normalizeWord("إِنَّ"), "ان");
  assert.equal(normalizeWord("عَلَىٰ"), "علي");
  assert.equal(normalizeWord("ٱلرَّحْمَـٰنِ"), "الرحمن");
});

test("sharedInOrder counts the source's words kept in order", () => {
  assert.equal(sharedInOrder(w("من دون الله"), w("من دون الله")), 3);
  assert.equal(sharedInOrder(w("بل الله يزكي من يشاء"), w("الله يزكي من يشاء")), 4);
  assert.equal(sharedInOrder(w("دون الله لا"), w("من دون الله")), 2);
  assert.equal(sharedInOrder(w("لهو ولعب"), w("لعب ولهو")), 0);
});

test("checkOccurrence: outside the verse", () => {
  const verse = w("ا ب ج د");
  assert.equal(checkOccurrence(verse, [3, 5], w("ج د ه")), "out-of-range");
  assert.equal(checkOccurrence(verse, [0, 2], w("ا ب ج")), "out-of-range");
  assert.equal(checkOccurrence(verse, [3, 2], w("ب")), "out-of-range");
});

test("checkOccurrence: same length, off by one word → misaligned (QUL's 29:17 «من دون الله»)", () => {
  const verse = w("ان الذين تعبدون من دون الله لا يملكون");
  assert.equal(checkOccurrence(verse, [5, 7], w("من دون الله")), "misaligned");
  assert.equal(checkOccurrence(verse, [3, 5], w("من دون الله")), "misaligned");
  assert.equal(checkOccurrence(verse, [4, 6], w("من دون الله")), "ok");
});

test("checkOccurrence: a variant of another length is kept, not shifted", () => {
  // «بل الله يزكي من يشاء» for «الله يزكي من يشاء»: a word more
  assert.equal(checkOccurrence(w("الم تر الي الذين يزكون انفسهم بل الله يزكي من يشاء ولا"), [7, 11], w("الله يزكي من يشاء")), "ok");
  // «لهو ولعب» for «الا لعب ولهو»: swapped, nothing in common position-wise
  assert.equal(checkOccurrence(w("وما هذه الحيوة الدنيا الا لهو ولعب وان"), [6, 7], w("الا لعب ولهو")), "ok");
});

test("checkOccurrence: same length but a different word in place → kept (a real variant)", () => {
  // «وما لهم به من علم» for «وما لهم بذلك من علم»
  assert.equal(checkOccurrence(w("وما لهم به من علم ان"), [1, 5], w("وما لهم بذلك من علم")), "ok");
});

const phrase = (source: string, from: number, to: number, count: number, ayah: RawPhrase["ayah"]): RawPhrase => ({
  surahs: 1,
  ayahs: Object.keys(ayah).length,
  count,
  source: { key: source, from, to },
  ayah,
});

const verses: Record<string, string> = {
  "1:1": "ا ب ج د ه",
  "1:2": "و ا ب ج ز",
  "2:5": "ح ا ب ج",
  "3:1": "ا ب ج د ه و ز",
  "3:2": "ط ي ا ب ج د ه",
};
const wordsOf = (key: string) => (verses[key] ? w(verses[key]) : null);

test("buildIndex: checks ranges, then filters by length, count and verses", () => {
  const raw: Record<string, RawPhrase> = {
    // kept: 3 words, 3 verses; 2:5's range is off by one and dropped
    "10": phrase("1:1", 1, 3, 3, { "1:1": [[1, 3]], "1:2": [[2, 4]], "2:5": [[1, 3]] }),
    // 2 words: too short
    "11": phrase("1:1", 1, 2, 2, { "1:1": [[1, 2]], "1:2": [[2, 3]] }),
    // seen 12 times: too common
    "12": phrase("1:1", 1, 3, 12, { "1:1": [[1, 3]], "1:2": [[2, 4]] }),
    // its other verse is out of range: one verse left
    "13": phrase("3:1", 4, 6, 2, { "3:1": [[4, 6]], "1:2": [[4, 6]] }),
    // the source range itself is outside its verse
    "14": phrase("2:5", 3, 6, 2, { "2:5": [[3, 6]], "1:1": [[3, 5]] }),
    // 5 words in two verses
    "15": phrase("3:1", 1, 5, 2, { "3:1": [[1, 5]], "3:2": [[3, 7]] }),
  };
  const { index, log } = buildIndex(raw, wordsOf, { minWords: 3, maxCount: 10 });
  assert.deepEqual(index.phrases, { "10": ["1:1", "1:2"], "15": ["3:1", "3:2"] });
  assert.deepEqual(index.verses["1:1"], [[10, 1, 3]]);
  assert.equal(index.verses["2:5"], undefined);
  assert.deepEqual(log, {
    phrasesIn: 6,
    occurrencesIn: 13,
    // 13's 1:2 range (14's aren't checked: its source is already out)
    outOfRange: 1,
    misaligned: 1,
    badSource: 1,
    tooShort: 1,
    tooCommon: 1,
    tooFewVerses: 1,
    phrasesOut: 2,
    versesOut: 4,
  });
});

test("buildIndex: a verse holding the phrase twice keeps both ranges, in order", () => {
  const raw = { "20": phrase("3:1", 1, 3, 3, { "3:2": [[3, 5]], "3:1": [[1, 3]] }), "21": phrase("3:2", 3, 5, 3, { "3:2": [[3, 5]], "1:1": [[1, 3]] }) };
  const { index } = buildIndex(raw, wordsOf, { minWords: 3, maxCount: 10 });
  assert.deepEqual(index.phrases["20"], ["3:1", "3:2"]);
  assert.deepEqual(index.verses["3:2"], [[20, 3, 5], [21, 3, 5]]);
});
