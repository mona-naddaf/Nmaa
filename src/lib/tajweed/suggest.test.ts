import { test } from "node:test";
import assert from "node:assert/strict";
import quranText from "@/lib/quran-data/quran-uthmani.json";
import { splitAyah } from "@/lib/quran-data/words";
import { GAP_GROUPS, LETTER_GROUPS } from "./taxonomy";
import { isJalala, orderedGroups, orderedSifat, suggestGapGroups, suggestLetterGroups, suggestMakharij } from "./suggest";

const SURAHS = (quranText as { surahs: string[][] }).surahs;
const word = (s: number, a: number, w: number) => splitAyah(s, a, SURAHS[s - 1][a - 1]).words[w - 1];
const first = (list: string[]) => list[0];

/** The gap after word w of s:a, as the picker will see it. */
function gap(s: number, a: number, w: number) {
  const left = word(s, a, w);
  const words = splitAyah(s, a, SURAHS[s - 1][a - 1]).words;
  const ayahEnd = w === words.length;
  const right = ayahEnd ? word(s, a + 1, 1) : words[w];
  return { left: left.text, leftMarks: left.marks, right: right.text, ayahEnd };
}

test("لفظ الجلالة with and without prefixes, not look-alikes", () => {
  for (const w of ["ٱللَّهِ", "لِلَّهِ", "وَٱللَّهُ", "بِٱللَّهِ", "تَٱللَّهِ", "فَلِلَّهِ", "ٱللَّهُمَّ"]) assert.ok(isJalala(w), w);
  for (const w of ["لَهُۥ", "إِلَـٰهَ", "ٱللَّهْوِ", "ٱلَّذِى"]) assert.ok(!isJalala(w), w);
});

test("letters: the likely group first", () => {
  assert.equal(first(suggestLetterGroups("ٱللَّهِ", 3)), "tafkhim"); // لام لفظ الجلالة
  assert.equal(first(suggestLetterGroups(word(2, 10, 9).text, 4)), "noon"); // أَلِيمٌۢ: tanween + iqlab
  assert.equal(first(suggestLetterGroups(word(2, 60, 10).text, 2)), "noon"); // مِنْهُ
  assert.equal(first(suggestLetterGroups(word(2, 60, 18).text, 6)), "meem"); // مَّشْرَبَهُمْ
  assert.equal(first(suggestLetterGroups(word(2, 60, 18).text, 1)), "ghunna"); // مَّ
  assert.equal(first(suggestLetterGroups(word(2, 245, 13).text, 3)), "qalqala"); // يَقْبِضُ
  assert.equal(first(suggestLetterGroups(word(1, 7, 9).text, 4)), "madd"); // ٱلضَّآلِّينَ: آ
  assert.equal(first(suggestLetterGroups(word(2, 5, 1).text, 4)), "madd"); // أُو۟لَـٰٓئِكَ: ـٰٓ
  assert.equal(first(suggestLetterGroups(word(1, 2, 1).text, 2)), "lam"); // ٱلْحَمْدُ
  assert.equal(first(suggestLetterGroups("رَبِّ", 1)), "tafkhim");
  assert.equal(first(suggestLetterGroups(word(11, 41, 6).text, 3)), "hafs"); // مَجْر۪ىٰهَا
  assert.equal(first(suggestLetterGroups(word(12, 11, 6).text, 3)), "hafs"); // تَأْمَ۫نَّا
  assert.equal(first(suggestLetterGroups(word(41, 44, 9).text, 2)), "hafs"); // ءَا۬عْجَمِىٌّ
  assert.equal(first(suggestLetterGroups(word(6, 143, 10).text, 2)), "hafs"); // ءَآلذَّكَرَيْنِ
  assert.equal(first(suggestLetterGroups(word(2, 245, 14).text, 4)), "hafs"); // وَيَبْصُۜطُ
  assert.equal(first(suggestLetterGroups(word(30, 54, 5).text, 1)), "hafs"); // ضَعْفٍ
  // the madd alif also follows the letter before it (تفخيم/ترقيق)
  assert.ok(suggestLetterGroups("قَالَ", 2).includes("tafkhim"));
  // the last letter: stopping on the word
  assert.ok(suggestLetterGroups(word(2, 4, 10).text, 9).includes("waqf_word")); // ...ةِ
  assert.ok(suggestLetterGroups(word(18, 2, 1).text, 4).includes("waqf_word")); // قَيِّمًا: مً
  assert.deepEqual(suggestLetterGroups("ٱللَّهِ", 9), []);
});

test("gaps: the likely group first", () => {
  assert.equal(first(suggestGapGroups(gap(75, 27, 2))), "gap_sakt"); // مَنْ ۜ رَاقٍ
  assert.equal(first(suggestGapGroups(gap(83, 14, 2))), "gap_sakt"); // بَلْ ۜ رَانَ
  assert.equal(first(suggestGapGroups(gap(18, 1, 11))), "gap_sakt"); // عِوَجَا ۜ — also an ayah end
  assert.ok(suggestGapGroups(gap(18, 1, 11)).includes("gap_waqf"));
  const nuh = suggestGapGroups(gap(11, 42, 8)); // نُوحٌ ٱبْنَهُۥ
  assert.equal(first(nuh), "gap_noon");
  assert.ok(nuh.includes("gap_wasl"));
  assert.equal(first(suggestGapGroups(gap(2, 60, 6))), "gap_idgham"); // ٱضْرِب بِّعَصَاكَ
  assert.equal(first(suggestGapGroups(gap(68, 1, 1))), "gap_idgham"); // نٓ ۚ وَٱلْقَلَمِ
  assert.ok(suggestGapGroups(gap(68, 1, 1)).includes("gap_waqf"));
  assert.equal(first(suggestGapGroups(gap(2, 60, 21))), "gap_noon"); // مِن رِّزْقِ
  assert.equal(first(suggestGapGroups(gap(2, 60, 13))), "gap_noon"); // عَيْنًا ۖ قَدْ
  assert.ok(suggestGapGroups(gap(2, 60, 13)).includes("gap_waqf"));
  assert.equal(first(suggestGapGroups(gap(2, 60, 18))), "gap_meem"); // مَّشْرَبَهُمْ ۖ كُلُوا۟
  assert.ok(suggestGapGroups(gap(2, 17, 9)).includes("gap_madd")); // حَوْلَهُۥ: الصلة
  assert.ok(suggestGapGroups({ left: "فِىٓ", leftMarks: "", right: "أَنفُسِكُمْ", ayahEnd: false }).includes("gap_madd"));
  assert.equal(first(suggestGapGroups(gap(1, 1, 4))), "gap_waqf"); // an ayah end
});

test("ordering never hides: every group is listed, the suggested ones first", () => {
  const letter = orderedGroups("LETTER", ["qalqala", "tafkhim", "nope"]);
  assert.equal(letter.length, LETTER_GROUPS.length);
  assert.deepEqual(letter.slice(0, 2).map((g) => [g.group.code, g.suggested]), [["qalqala", true], ["tafkhim", true]]);
  assert.ok(letter.slice(2).every((g) => !g.suggested));
  assert.equal(orderedGroups("GAP", []).length, GAP_GROUPS.length);
  const sifat = orderedSifat("ضَ", 1);
  assert.equal(sifat.length, 16);
  assert.deepEqual(sifat.filter((s) => s.suggested).map((s) => s.code), ["jahr", "rakhawa", "istila", "itbaq", "istitala"]);
  assert.deepEqual(suggestMakharij("مِنْهُ", 2), ["taraf_lisan_n", "khayshum"]);
});
