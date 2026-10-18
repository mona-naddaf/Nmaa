import { test } from "node:test";
import assert from "node:assert/strict";
import { ayatCount, exactSurah, findSurahs } from "./surah-search";

const names = (q: string) => findSurahs(q).map((s) => s.name);

test("surah search: «سورة», hamza, taa marbuta, alif maqsura and a missing «ال»", () => {
  assert.equal(findSurahs("الكهف")[0].number, 18);
  assert.equal(findSurahs("سورة الكهف")[0].number, 18);
  assert.equal(findSurahs("كهف")[0].number, 18);
  assert.equal(findSurahs("الاسراء")[0].number, 17);
  assert.equal(findSurahs("البقره")[0].number, 2);
  assert.equal(findSurahs("الضحي")[0].number, 93);
  assert.equal(findSurahs("ال عمران")[0].number, 3);
  assert.equal(findSurahs("النساء")[0].number, 4);
});

test("surah search: best match first, a number finds its surah, nothing for nonsense", () => {
  // «النور» itself before names that only contain it
  assert.equal(names("النور")[0], "النور");
  assert.deepEqual(findSurahs("18").map((s) => s.number), [18]);
  assert.deepEqual(findSurahs("١١٤").map((s) => s.number), [114]);
  assert.deepEqual(findSurahs("115"), []);
  assert.deepEqual(findSurahs("زززز"), []);
  assert.deepEqual(findSurahs("   "), []);
});

test("exact surah: only a complete name or a number", () => {
  assert.equal(exactSurah("سورة الكهف")?.number, 18);
  assert.equal(exactSurah("كهف")?.number, 18);
  assert.equal(exactSurah("الكه"), null);
  assert.equal(exactSurah("36")?.number, 36);
});

test("verse counts agree with their number", () => {
  assert.equal(ayatCount(7), "7 آيات");
  assert.equal(ayatCount(110), "110 آيات");
  assert.equal(ayatCount(286), "286 آية");
  assert.equal(ayatCount(11), "11 آية");
});
