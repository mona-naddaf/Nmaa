import { test } from "node:test";
import assert from "node:assert/strict";
import { groupsForSurah, groupsForVerse, isIndexed, partnersOf } from "./lookup";
import type { MutashabihatIndex } from "./build";

const index: MutashabihatIndex = {
  phrases: {
    "1": ["2:23", "10:38", "29:17"],
    "2": ["2:23", "11:13"],
    "3": ["29:17", "46:5"],
  },
  verses: {
    "2:23": [
      [2, 4, 6],
      [1, 15, 17],
    ],
    "10:38": [[1, 11, 13]],
    "11:13": [[2, 4, 7]],
    // the same phrase twice in one verse
    "29:17": [
      [1, 3, 5],
      [3, 4, 6],
      [1, 12, 14],
    ],
    "46:5": [[3, 5, 7]],
  },
};

test("groupsForVerse: one group per phrase, ordered by where it starts here", () => {
  assert.deepEqual(groupsForVerse(index, "2:23"), [
    { phraseId: 2, own: [[4, 6]], others: [{ key: "11:13", ranges: [[4, 7]] }] },
    {
      phraseId: 1,
      own: [[15, 17]],
      others: [
        { key: "10:38", ranges: [[11, 13]] },
        { key: "29:17", ranges: [[3, 5], [12, 14]] },
      ],
    },
  ]);
});

test("groupsForVerse: a phrase twice in the verse keeps both own ranges", () => {
  const groups = groupsForVerse(index, "29:17");
  assert.deepEqual(groups.map((g) => g.phraseId), [1, 3]);
  assert.deepEqual(groups[0].own, [[3, 5], [12, 14]]);
  assert.deepEqual(groups[0].others.map((o) => o.key), ["2:23", "10:38"]);
  assert.deepEqual(groups[1].others, [{ key: "46:5", ranges: [[5, 7]] }]);
});

test("groupsForVerse: a verse with no phrase has no groups", () => {
  assert.deepEqual(groupsForVerse(index, "1:1"), []);
  assert.deepEqual(groupsForVerse(index, "nonsense"), []);
});

test("groupsForSurah: only that surah's marked verses, by ayah number", () => {
  const s29 = groupsForSurah(index, 29);
  assert.deepEqual(Object.keys(s29), ["17"]);
  assert.equal(s29[17].length, 2);
  // «2:23» must not leak into surah 29 (or 2 into 29's prefix)
  assert.deepEqual(Object.keys(groupsForSurah(index, 2)), ["23"]);
  assert.deepEqual(groupsForSurah(index, 114), {});
});

test("partnersOf: distinct other verses in mushaf order; isIndexed", () => {
  assert.deepEqual(partnersOf(index, "29:17"), ["2:23", "10:38", "46:5"]);
  assert.deepEqual(partnersOf(index, "1:1"), []);
  assert.equal(isIndexed(index, "46:5"), true);
  assert.equal(isIndexed(index, "1:1"), false);
  assert.equal(isIndexed(index, "constructor"), false);
});
